// =====================================================
// Akıllı Sepet - Urun Servisi
// Urun CRUD, barkod eslestirme, kategori, arama
// =====================================================

import {
  Injectable, NotFoundException, ConflictException, Logger,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto, ProductSortBy, SortOrder } from './dto/product-filter.dto';
import { AddBarcodeDto } from './dto/add-barcode.dto';
import {
  buildCategoryTree, resolveCategoryFilterIds, type CategoryRow,
} from './category.helper';
import { classifyProduct } from './category-classifier';
import { OpenFoodFactsService } from './openfoodfacts.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly off: OpenFoodFactsService,
  ) {}

  // ---- Urun Listele (Arama + Filtre + Sayfalama + Siralama) ----
  async findAll(filter: ProductFilterDto) {
    const {
      page = 1, limit = 20, search, categoryId, brand, marketId,
      sortBy = ProductSortBy.CREATED_AT,
      sortOrder = SortOrder.DESC,
      isActive,
    } = filter;
    const skip = (page - 1) * limit;
    const dir: 'asc' | 'desc' = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    const categoryScope = categoryId
      ? await this.resolveCategoryFilter(categoryId)
      : undefined;

    const commonInclude = {
      category: {
        select: {
          id: true, name: true, slug: true, icon: true,
          parent: { select: { id: true, name: true, slug: true, icon: true } },
        },
      },
      barcodes: { select: { id: true, code: true, format: true }, take: 1 },
      prices: {
        where: { isAvailable: true },
        orderBy: { amount: 'asc' as const },
        take: 1,
        select: { amount: true, market: { select: { id: true, name: true, brandColor: true } } },
      },
    } as const;

    // Full-text search + relevance (PostgreSQL tsvector)
    if (search?.trim()) {
      try {
        return await this.findAllWithFullText(
          { page, limit, search: search.trim(), isActive, sortBy, sortOrder, marketId },
          categoryScope,
          commonInclude,
        );
      } catch (err) {
        this.logger.warn(`FTS arama basarisiz, ILIKE fallback: ${(err as Error).message}`);
      }
    }

    // isActive belirtilmemisse tüm ürünler (admin için), belirtilirse filtrele
    const where: Record<string, unknown> = {
      ...(isActive !== undefined && { isActive }),
      ...(search && { OR: this.buildSearchConditions(search) }),
      ...(categoryScope && { categoryId: { in: categoryScope } }),
      ...(brand && { brand: { contains: brand, mode: 'insensitive' as const } }),
      ...(marketId && {
        prices: { some: { marketId, isAvailable: true } },
      }),
    };

    // SKT tarihi siralamasi: raporlardaki en yakin expiry date'e gore sirala
    if (sortBy === ProductSortBy.EXPIRY_DATE) {
      const [allItems, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: {
            ...commonInclude,
            reports: {
              where: { expiryDate: { not: null } },
              orderBy: { expiryDate: 'asc' },
              take: 1,
              select: { expiryDate: true },
            },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      // Uygulama katmaninda SKT tarihine gore sirala
      const noDate = dir === 'asc' ? Infinity : -Infinity;
      const sorted = allItems.sort((a, b) => {
        const aT = (a as any).reports[0]?.expiryDate?.getTime() ?? noDate;
        const bT = (b as any).reports[0]?.expiryDate?.getTime() ?? noDate;
        return dir === 'asc' ? aT - bT : bT - aT;
      });

      const paged = sorted.slice(skip, skip + limit).map((p) => ({
        ...p,
        lowestPrice: p.prices[0]?.amount ?? null,
        lowestPriceMarket: p.prices[0]?.market ?? null,
        nearestExpiryDate: (p as any).reports[0]?.expiryDate ?? null,
        prices: undefined,
        reports: undefined,
      }));

      return { items: paged, total, page, limit, totalPages: Math.ceil(total / limit), hasNext: page * limit < total };
    }

    // Normal Prisma siralama
    let orderBy: unknown;
    switch (sortBy) {
      case ProductSortBy.NAME:      orderBy = { name: dir };                break;
      case ProductSortBy.BRAND:     orderBy = { brand: dir };               break;
      case ProductSortBy.CATEGORY:  orderBy = { category: { name: dir } };  break;
      case ProductSortBy.PRICE:     orderBy = { name: dir };                break; // fiyat fallback
      default:                      orderBy = { createdAt: dir };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderBy as never,
        include: commonInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    const enriched = items.map((p) => ({
      ...p,
      lowestPrice: p.prices[0]?.amount ?? null,
      lowestPriceMarket: p.prices[0]?.market ?? null,
      prices: undefined,
    }));

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
    };
  }

  // ---- Urun Detayi ----
  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: {
        category: {
          include: { parent: { select: { id: true, name: true, slug: true, icon: true } } },
        },
        barcodes: true,
        prices: {
          where: { isAvailable: true },
          include: {
            market: { select: { id: true, name: true, logoUrl: true, brandColor: true, slug: true } },
          },
          orderBy: { amount: 'asc' },
        },
      },
    });

    if (!product) throw new NotFoundException('Urun bulunamadi');
    return product;
  }

  // ---- Iliskili Urunler (sepet birlikteligi + kategori) ----
  async findRelated(id: string, limit = 6) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, categoryId: true },
    });
    if (!product) throw new NotFoundException('Urun bulunamadi');

    const coItems = await this.prisma.cartItem.findMany({
      where: {
        cart: { items: { some: { productId: id } } },
        productId: { not: id },
      },
      select: { productId: true },
      take: 200,
    });

    const counts = new Map<string, number>();
    coItems.forEach((i) => counts.set(i.productId, (counts.get(i.productId) ?? 0) + 1));

    let relatedIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([pid]) => pid);

    if (relatedIds.length < limit) {
      const categoryProducts = await this.prisma.product.findMany({
        where: {
          categoryId: product.categoryId,
          id: { notIn: [id, ...relatedIds] },
          isActive: true,
        },
        take: limit - relatedIds.length,
        select: { id: true },
      });
      relatedIds = [...relatedIds, ...categoryProducts.map((p) => p.id)];
    }

    if (relatedIds.length === 0) return { items: [] };

    const items = await this.prisma.product.findMany({
      where: { id: { in: relatedIds }, isActive: true },
      include: {
        prices: {
          where: { isAvailable: true },
          orderBy: { amount: 'asc' },
          take: 1,
          select: { amount: true, market: { select: { name: true } } },
        },
      },
    });

    const order = new Map(relatedIds.map((rid, idx) => [rid, idx]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    return { items };
  }

  // ---- Barkod ile Urun Bul (yalnizca yerel DB) ----
  // Harici kaynak: DATA_SYNC_EXTERNAL_PROVIDERS_ENABLED=true + connector gerekir
  async findByBarcode(code: string) {
    // ── 1. Önce kendi veritabanımıza bak ─────────────
    const barcode = await this.prisma.barcode.findUnique({
      where: { code },
      include: {
        product: {
          include: {
            category: true,
            barcodes: true,
            prices: {
              where: { isAvailable: true },
              include: {
                market: { select: { id: true, name: true, logoUrl: true, brandColor: true } },
              },
              orderBy: { amount: 'asc' },
            },
          },
        },
      },
    });

    if (barcode) return barcode.product;

    // ── 2. DB'de yok → Open Food Facts'e sor ─────────
    this.logger.log(`Barkod DB'de yok, Open Food Facts sorgulanıyor: ${code}`);
    const offData = await this.off.lookup(code);

    if (!offData) {
      throw new NotFoundException(
        `"${code}" barkoduna ait ürün bulunamadı (yerel DB ve Open Food Facts kontrol edildi)`,
      );
    }

    // ── 3. OFF'tan gelen ürünü DB'ye kaydet ──────────
    const categoryId = await this.resolveOFFCategory(offData.categoriesRaw);

    const newProduct = await this.prisma.product.create({
      data: {
        name:     offData.name,
        brand:    offData.brand ?? undefined,
        imageUrl: offData.imageUrl ?? undefined,
        unit:     this.parseUnit(offData.quantity),
        isActive: true,
        categoryId,
        barcodes: {
          create: { code, format: 'EAN_13' },
        },
      },
      include: {
        category: true,
        barcodes: true,
        prices: {
          where: { isAvailable: true },
          include: {
            market: { select: { id: true, name: true, logoUrl: true, brandColor: true } },
          },
          orderBy: { amount: 'asc' },
        },
      },
    });

    this.logger.log(
      `Open Food Facts → yeni ürün oluşturuldu: "${newProduct.name}" (${code})`,
    );
    return newProduct;
  }

  /** OFF kategori tag'lerini DB'deki kategori id'sine çevirir; yoksa "Diğer" kullanır */
  private async resolveOFFCategory(tags: string[]): Promise<string> {
    const hint = OpenFoodFactsService.mapCategoryHint(tags);

    // İsim eşleşmesi dene
    const match = await this.prisma.category.findFirst({
      where: { name: { contains: hint.split(' ')[0], mode: 'insensitive' } },
      select: { id: true },
    });
    if (match) return match.id;

    // "Diğer" veya ilk kategoriyi fallback olarak kullan
    const fallback = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: { contains: 'Diğer', mode: 'insensitive' } },
          { name: { contains: 'Genel', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (fallback) return fallback.id;

    // Son çare: DB'deki ilk kategori
    const first = await this.prisma.category.findFirst({ select: { id: true } });
    if (first) return first.id;

    throw new Error('Veritabanında hiç kategori yok. Önce kategori verisini import edin.');
  }

  /** "1 L", "350 g", "500 ml" → birim çıkar */
  private parseUnit(quantity: string | null): string | undefined {
    if (!quantity) return undefined;
    const m = quantity.match(/\b(ml|l|g|kg|cl|adet)\b/i);
    return m ? m[1].toLowerCase() : undefined;
  }

  // ---- Kategori Oneri Analizi (Admin / Market Yoneticisi) ----
  async getCategorySuggestions(actor?: { id: string; role: UserRole }) {
    const scopedMarketId = actor?.role === UserRole.MARKET_MANAGER
      ? await this.getManagedMarketId(actor.id)
      : undefined;

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, slug: true, parentId: true,
        _count: { select: { children: true } },
      },
    });
    const slugToCat = new Map(categories.map((c) => [c.slug, c]));
    const idToCat = new Map(categories.map((c) => [c.id, c]));

    const products = await this.prisma.product.findMany({
      where: scopedMarketId
        ? { prices: { some: { marketId: scopedMarketId, isAvailable: true } } }
        : undefined,
      select: {
        id: true,
        name: true,
        brand: true,
        categoryId: true,
        category: { select: { id: true, name: true, slug: true, parentId: true } },
      },
      orderBy: { name: 'asc' },
    });

    const suggestions: Array<{
      productId: string;
      productName: string;
      brand: string | null;
      currentCategoryId: string;
      currentCategoryName: string;
      suggestedCategoryId: string;
      suggestedCategoryName: string;
    }> = [];

    for (const p of products) {
      const suggestedSlug = classifyProduct(p.name, p.brand ?? '');
      if (!suggestedSlug) continue;

      const suggestedCat = slugToCat.get(suggestedSlug);
      if (!suggestedCat) continue;

      // Yalnizca yaprak (alt) kategorilere oner — ust kategori atamasi yapilmaz
      if (suggestedCat._count.children > 0) continue;

      if (this.isCategoryCompatible(p.category, suggestedSlug, idToCat)) continue;

      suggestions.push({
        productId: p.id,
        productName: p.name,
        brand: p.brand,
        currentCategoryId: p.categoryId,
        currentCategoryName: p.category.name,
        suggestedCategoryId: suggestedCat.id,
        suggestedCategoryName: suggestedCat.name,
      });
    }

    return {
      total: products.length,
      mismatchCount: suggestions.length,
      suggestions,
      scopedMarketId: scopedMarketId ?? null,
    };
  }

  // ---- Kategori Düzeltme Uygula (Admin / Market Yoneticisi) ----
  async applyCategories(
    fixes: Array<{ productId: string; categoryId: string }>,
    actor?: { id: string; role: UserRole },
  ) {
    if (!fixes.length) return { updated: 0 };

    const scopedMarketId = actor?.role === UserRole.MARKET_MANAGER
      ? await this.getManagedMarketId(actor.id)
      : undefined;

    for (const f of fixes) {
      if (scopedMarketId) {
        await this.assertProductInMarket(f.productId, scopedMarketId);
      }
      await this.assertLeafCategory(f.categoryId);
    }

    await Promise.all(
      fixes.map((f) =>
        this.prisma.product.update({
          where: { id: f.productId },
          data: { categoryId: f.categoryId },
        }),
      ),
    );

    this.logger.log(`Kategori düzeltme uygulandı: ${fixes.length} ürün`);
    return { updated: fixes.length };
  }

  // ---- Urun Ozet Istatistikleri (Admin) ----
  async getStats() {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [total, active, sktNearby30, withBarcode] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count({
        where: {
          reports: {
            some: {
              expiryDate: { not: null, gte: now, lte: in30Days },
            },
          },
        },
      }),
      this.prisma.product.count({
        where: { barcodes: { some: {} } },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      sktNearby30,
      withBarcode,
      withoutBarcode: total - withBarcode,
    };
  }

  // ---- Kategorileri Listele ----
  async findCategories(flat = false) {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    }) as CategoryRow[];

    if (flat) return rows;
    return buildCategoryTree(rows);
  }

  /** Ust kategori secildiginde alt kategorilerdeki urunleri de kapsar */
  private async resolveCategoryFilter(categoryId: string): Promise<string[]> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, slug: true, icon: true, parentId: true, sortOrder: true,
      },
    }) as CategoryRow[];

    return resolveCategoryFilterIds(categoryId, rows);
  }

  // ---- Urun Olustur ----
  async create(dto: CreateProductDto) {
    const { barcodes, ...productData } = dto;

    // Kategori var mi?
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadi');

    // Barkod benzersizligini kontrol et
    if (barcodes?.length) {
      const existing = await this.prisma.barcode.findFirst({
        where: { code: { in: barcodes } },
      });
      if (existing) {
        throw new ConflictException(`"${existing.code}" barkodu zaten kullaniliyor`);
      }
    }

    return this.prisma.product.create({
      data: {
        name: productData.name,
        brand: productData.brand ?? null,
        description: productData.description ?? null,
        categoryId: productData.categoryId,
        unit: productData.unit ?? null,
        unitValue: productData.unitValue ?? null,
        imageUrl: productData.imageUrl ?? null,
        slug: this.generateSlug(dto.name),
        ...(barcodes?.length && {
          barcodes: { create: barcodes.map((code) => ({ code })) },
        }),
      },
      include: {
        category: {
          include: { parent: { select: { id: true, name: true, slug: true, icon: true } } },
        },
        barcodes: true,
      },
    });
  }

  // ---- Urun Guncelle ----
  async update(
    id: string,
    dto: UpdateProductDto,
    actor?: { id: string; role: UserRole },
  ) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Urun bulunamadi');

    if (actor?.role === UserRole.MARKET_MANAGER) {
      if (!dto.categoryId) {
        throw new ForbiddenException('Market yoneticisi yalnizca kategori guncelleyebilir');
      }
      const marketId = await this.getManagedMarketId(actor.id);
      await this.assertProductInMarket(id, marketId);
      await this.assertLeafCategory(dto.categoryId);
      return this.prisma.product.update({
        where: { id },
        data: { categoryId: dto.categoryId },
        include: {
          category: {
            include: { parent: { select: { id: true, name: true, slug: true, icon: true } } },
          },
          barcodes: true,
        },
      });
    }

    if (dto.categoryId) {
      await this.assertLeafCategory(dto.categoryId);
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.name && { slug: this.generateSlug(dto.name) }),
      },
      include: {
        category: {
          include: { parent: { select: { id: true, name: true, slug: true, icon: true } } },
        },
        barcodes: true,
      },
    });
  }

  // ---- Barkod Ekle ----
  async addBarcode(productId: string, dto: AddBarcodeDto) {
    await this.findOne(productId);

    const existing = await this.prisma.barcode.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`"${dto.code}" barkodu baska bir urunde zaten kayitli`);
    }

    return this.prisma.barcode.create({
      data: { code: dto.code, format: dto.format, productId },
    });
  }

  /** PostgreSQL full-text search — plainto_tsquery AND mantığı + ts_rank sıralama */
  private async findAllWithFullText(
    opts: {
      page: number; limit: number; search: string;
      isActive?: boolean;
      sortBy: ProductSortBy;
      sortOrder: SortOrder;
      marketId?: string;
    },
    categoryScope: string[] | undefined,
    commonInclude: Record<string, unknown>,
  ) {
    const { page, limit, search, isActive, sortBy, sortOrder, marketId } = opts;
    const skip = (page - 1) * limit;
    const likePattern = `%${search}%`;

    const categorySql = categoryScope?.length
      ? Prisma.sql`AND p."categoryId" IN (${Prisma.join(categoryScope)})`
      : Prisma.empty;

    const activeSql = isActive !== undefined
      ? Prisma.sql`AND p."isActive" = ${isActive}`
      : Prisma.empty;

    const marketSql = marketId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM prices pr
          WHERE pr."productId" = p.id AND pr."marketId" = ${marketId} AND pr."isAvailable" = true
        )`
      : Prisma.empty;

    const searchWhere = Prisma.sql`
      (
        p.search_vector @@ plainto_tsquery('turkish', ${search})
        OR EXISTS (
          SELECT 1 FROM prices pr
          INNER JOIN markets m ON m.id = pr."marketId"
          WHERE pr."productId" = p.id AND pr."isAvailable" = true
            AND m.name ILIKE ${likePattern}
        )
        OR EXISTS (
          SELECT 1 FROM barcodes b
          WHERE b."productId" = p.id AND b.code ILIKE ${likePattern}
        )
      )
    `;

    const countRows = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count FROM products p
      WHERE ${searchWhere} ${categorySql} ${activeSql} ${marketSql}
    `;
    const total = Number(countRows[0]?.count ?? 0);

    if (total === 0) {
      return { items: [], total: 0, page, limit, totalPages: 0, hasNext: false };
    }

    const ranked = await this.prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT p.id,
        GREATEST(
          COALESCE(ts_rank(p.search_vector, plainto_tsquery('turkish', ${search})), 0),
          CASE WHEN p.name ILIKE ${likePattern} THEN 0.4 ELSE 0 END,
          CASE WHEN p.brand ILIKE ${likePattern} THEN 0.2 ELSE 0 END
        )::float8 AS rank
      FROM products p
      WHERE ${searchWhere} ${categorySql} ${activeSql} ${marketSql}
      ORDER BY
        ${sortBy === ProductSortBy.NAME
          ? (sortOrder === SortOrder.ASC ? Prisma.sql`p.name ASC` : Prisma.sql`p.name DESC`)
          : Prisma.sql`rank DESC, p.name ASC`}
      LIMIT ${limit} OFFSET ${skip}
    `;

    const ids = ranked.map((r) => r.id);
    const items = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: commonInclude as never,
    });

    const order = new Map(ids.map((id, i) => [id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    type WithPrices = typeof items[number] & {
      prices: { amount: number; market: { id: string; name: string; brandColor: string | null } }[];
    };
    const enriched = items.map((p) => {
      const row = p as WithPrices;
      return {
        ...row,
        lowestPrice: row.prices[0]?.amount ?? null,
        lowestPriceMarket: row.prices[0]?.market ?? null,
        prices: undefined,
      };
    });

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
    };
  }

  /**
   * Akıllı çok-kelimeli ürün araması (FTS fallback):
   * 1. Tam ifade eşleşmesi (ör. "filiz makarna" içeren)
   * 2. Tüm token'lar herhangi bir sırada ad/marka içinde geçiyor mu
   * 3. Market adı araması (ör. "migros" → o marketteki ürünler)
   * 4. Barkod araması
   *
   * "Elma suyu" için: hem name hem brand'de "elma" VE "suyu" geçmeli →
   * sadece "elma" olan ürün elenmiş olur.
   */
  private buildSearchConditions(raw: string): object[] {
    const s = raw.trim();
    if (!s) return [];

    // Anlamlı token'lar (2+ karakter, rakam içermeyenler ağırlıklı)
    const words = s.split(/\s+/).filter((w) => w.length >= 2);

    const conditions: object[] = [
      // Tam ifade eşleşmesi — en kesin sonuç
      { name:  { contains: s, mode: 'insensitive' as const } },
      { brand: { contains: s, mode: 'insensitive' as const } },
      // Barkod
      { barcodes: { some: { code: { contains: s } } } },
      // Market adı araması (ör. "migros", "bim", "a101")
      {
        prices: {
          some: {
            isAvailable: true,
            market: { name: { contains: s, mode: 'insensitive' as const } },
          },
        },
      },
    ];

    // Çok kelimeli arama: tüm token'lar ad VEYA markada sırasız geçiyor mu
    // "filiz makarna" → name'de "filiz" + name/brand'de "makarna" → "Filiz Boru Makarna" bulunur
    if (words.length > 1) {
      conditions.push({
        AND: words.map((w) => ({
          OR: [
            { name:  { contains: w, mode: 'insensitive' as const } },
            { brand: { contains: w, mode: 'insensitive' as const } },
          ],
        })),
      });
    }

    return conditions;
  }

  private async getManagedMarketId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { managedMarketId: true },
    });
    if (!user?.managedMarketId) {
      throw new ForbiddenException('Yonetilen market bulunamadi');
    }
    return user.managedMarketId;
  }

  private async assertProductInMarket(productId: string, marketId: string) {
    const price = await this.prisma.price.findFirst({
      where: { productId, marketId, isAvailable: true },
      select: { id: true },
    });
    if (!price) {
      throw new ForbiddenException('Bu urun marketinizin katalogunda degil');
    }
  }

  private async assertLeafCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { children: true } } },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadi');
    if (category._count.children > 0) {
      throw new BadRequestException('Urunler yalnizca alt kategoriye atanabilir');
    }
  }

  /** Mevcut kategori ile onerilen slug uyumlu mu (ust/alt iliskisi dahil) */
  private isCategoryCompatible(
    productCat: { id: string; slug: string; parentId: string | null },
    suggestedSlug: string,
    idToCat: Map<string, { id: string; slug: string; parentId: string | null }>,
  ): boolean {
    if (productCat.slug === suggestedSlug) return true;

    const suggested = [...idToCat.values()].find((c) => c.slug === suggestedSlug);
    if (!suggested) return false;

    if (productCat.parentId === suggested.id) return true;
    if (suggested.parentId === productCat.id) return true;

    let cur = productCat;
    while (cur.parentId) {
      const parent = idToCat.get(cur.parentId);
      if (!parent) break;
      if (parent.slug === suggestedSlug) return true;
      cur = parent;
    }

    return false;
  }

  // ---- Yardimci: URL dostu slug uret ----
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }
}
