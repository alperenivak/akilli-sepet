// =====================================================
// Akıllı Sepet - Katalog Servisi
// Aktüel market dergi/katalog yönetimi
// =====================================================

import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { AddCatalogPageDto } from './dto/add-catalog-page.dto';
import { BulkAddCatalogPagesDto } from './dto/bulk-add-catalog-pages.dto';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const catalogInclude = {
  market: { select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true } },
  _count: { select: { pages: true } },
};

const catalogDetailInclude = {
  market: { select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true } },
  pages: { orderBy: { pageNumber: 'asc' as const } },
};

@Injectable()
export class CatalogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ---- Aktif Kataloglar (mobil / public) ----
  async findActive(marketId?: string) {
    return this.prisma.catalog.findMany({
      where: {
        isActive: true,
        market: { isActive: true },
        ...(marketId && { marketId }),
      },
      include: catalogInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ---- Market yöneticisi: kendi marketinin tüm katalogları ----
  async findForManager(actor: AuthenticatedUser, marketId?: string) {
    const scopedMarketId = await this.resolveMarketScope(actor, marketId);
    return this.prisma.catalog.findMany({
      where: { marketId: scopedMarketId },
      include: catalogInclude,
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ---- Tüm Kataloglar (Admin) ----
  async findAll(page = 1, limit = 20, marketId?: string) {
    const skip = (page - 1) * limit;
    const where = marketId ? { marketId } : {};

    const [items, total] = await Promise.all([
      this.prisma.catalog.findMany({
        where,
        include: catalogInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.catalog.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ---- Katalog Detayı + Sayfalar ----
  async findOne(id: string, actor?: AuthenticatedUser) {
    const catalog = await this.prisma.catalog.findUnique({
      where: { id },
      include: catalogDetailInclude,
    });
    if (!catalog) throw new NotFoundException('Katalog bulunamadı');
    if (actor) await this.assertCatalogAccess(catalog.marketId, actor);
    return catalog;
  }

  // ---- Katalog Oluştur ----
  async create(dto: CreateCatalogDto, actor: AuthenticatedUser) {
    await this.assertMarketAccess(dto.marketId, actor);

    const market = await this.prisma.market.findUnique({ where: { id: dto.marketId } });
    if (!market) throw new NotFoundException('Market bulunamadı');

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start) throw new BadRequestException('Bitiş tarihi başlangıçtan sonra olmalı');

    return this.prisma.catalog.create({
      data: {
        marketId: dto.marketId,
        title: dto.title,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        pdfUrl: dto.pdfUrl,
        startDate: start,
        endDate: end,
        scrapeSource: 'manual',
      },
      include: { market: { select: { id: true, name: true } } },
    });
  }

  // ---- Katalog Güncelle ----
  async update(id: string, dto: UpdateCatalogDto, actor: AuthenticatedUser) {
    const catalog = await this.getCatalogOrThrow(id);
    await this.assertCatalogAccess(catalog.marketId, actor);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.pdfUrl !== undefined) data.pdfUrl = dto.pdfUrl;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.catalog.update({
      where: { id },
      data,
      include: { market: { select: { id: true, name: true } } },
    });
  }

  // ---- Katalog Sil ----
  async remove(id: string, actor: AuthenticatedUser) {
    const catalog = await this.getCatalogOrThrow(id);
    await this.assertCatalogAccess(catalog.marketId, actor);
    await this.prisma.catalog.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ---- Sayfa Ekle ----
  async addPage(catalogId: string, dto: AddCatalogPageDto, actor: AuthenticatedUser) {
    const catalog = await this.getCatalogOrThrow(catalogId);
    await this.assertCatalogAccess(catalog.marketId, actor);

    const existing = await this.prisma.catalogPage.findFirst({
      where: { catalogId, pageNumber: dto.pageNumber },
    });
    if (existing) throw new BadRequestException(`Sayfa ${dto.pageNumber} zaten mevcut`);

    const page = await this.prisma.catalogPage.create({ data: { ...dto, catalogId } });
    await this.syncPageCount(catalogId);
    return page;
  }

  // ---- Toplu Sayfa Ekle ----
  async bulkAddPages(catalogId: string, dto: BulkAddCatalogPagesDto, actor: AuthenticatedUser) {
    const catalog = await this.getCatalogOrThrow(catalogId);
    await this.assertCatalogAccess(catalog.marketId, actor);

    const lastPage = await this.prisma.catalogPage.findFirst({
      where: { catalogId },
      orderBy: { pageNumber: 'desc' },
    });
    let nextNum = lastPage?.pageNumber ?? 0;

    const created: Awaited<ReturnType<typeof this.prisma.catalogPage.create>>[] = [];
    for (const url of dto.imageUrls.map((u) => u.trim()).filter(Boolean)) {
      nextNum += 1;
      const page = await this.prisma.catalogPage.create({
        data: { catalogId, pageNumber: nextNum, imageUrl: url },
      });
      created.push(page);
    }

    if (created.length === 0) {
      throw new BadRequestException('Geçerli görsel URL bulunamadı');
    }

    const patch: Record<string, unknown> = {};
    if (!catalog.coverImageUrl && created[0]) {
      patch.coverImageUrl = created[0].imageUrl;
    }
    await this.syncPageCount(catalogId, patch);

    return { added: created.length, pages: created };
  }

  // ---- Görsel Yükle (MinIO) ----
  async uploadImage(
    catalogId: string,
    file: Express.Multer.File,
    type: 'cover' | 'page',
    actor: AuthenticatedUser,
  ) {
    const catalog = await this.getCatalogOrThrow(catalogId);
    await this.assertCatalogAccess(catalog.marketId, actor);

    const { url } = await this.storage.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      `catalogs/${catalogId}`,
    );

    if (type === 'cover') {
      return this.prisma.catalog.update({
        where: { id: catalogId },
        data: { coverImageUrl: url },
        select: { id: true, coverImageUrl: true },
      });
    }

    const lastPage = await this.prisma.catalogPage.findFirst({
      where: { catalogId },
      orderBy: { pageNumber: 'desc' },
    });
    const pageNumber = (lastPage?.pageNumber ?? 0) + 1;

    const page = await this.prisma.catalogPage.create({
      data: { catalogId, pageNumber, imageUrl: url, thumbnailUrl: url },
    });

    const patch: Record<string, unknown> = {};
    if (!catalog.coverImageUrl) patch.coverImageUrl = url;
    await this.syncPageCount(catalogId, patch);

    return { page, url };
  }

  // ---- Sayfa Sil ----
  async removePage(catalogId: string, pageId: string, actor: AuthenticatedUser) {
    const catalog = await this.getCatalogOrThrow(catalogId);
    await this.assertCatalogAccess(catalog.marketId, actor);

    const page = await this.prisma.catalogPage.findFirst({ where: { id: pageId, catalogId } });
    if (!page) throw new NotFoundException('Sayfa bulunamadı');

    await this.prisma.catalogPage.delete({ where: { id: pageId } });
    await this.syncPageCount(catalogId);
    return { deleted: true, id: pageId };
  }

  // ---- Kapak = ilk sayfa ----
  async setCoverFromFirstPage(catalogId: string, actor: AuthenticatedUser) {
    const catalog = await this.getCatalogOrThrow(catalogId);
    await this.assertCatalogAccess(catalog.marketId, actor);

    const first = await this.prisma.catalogPage.findFirst({
      where: { catalogId },
      orderBy: { pageNumber: 'asc' },
    });
    if (!first) throw new BadRequestException('Katalogda sayfa yok');

    return this.prisma.catalog.update({
      where: { id: catalogId },
      data: { coverImageUrl: first.imageUrl },
      select: { id: true, coverImageUrl: true },
    });
  }

  // ---- Aktif/Pasif Toggle ----
  async toggleActive(id: string, actor: AuthenticatedUser) {
    const catalog = await this.getCatalogOrThrow(id);
    await this.assertCatalogAccess(catalog.marketId, actor);
    return this.prisma.catalog.update({
      where: { id },
      data: { isActive: !catalog.isActive },
      select: { id: true, title: true, isActive: true },
    });
  }

  // ---- Süresi Dolan Katalogları Pasife Al (Cron) ----
  async deactivateExpired(): Promise<{ count: number }> {
    const result = await this.prisma.catalog.updateMany({
      where: { endDate: { lt: new Date() }, isActive: true },
      data: { isActive: false },
    });
    return { count: result.count };
  }

  // ---- Market slug (scraper için) ----
  async getMarketSlugForManager(actor: AuthenticatedUser): Promise<string> {
    const marketId = await this.getManagedMarketId(actor.id);
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      select: { slug: true },
    });
    if (!market?.slug) throw new NotFoundException('Market bulunamadı');
    return market.slug;
  }

  // ---- Yardımcılar ----

  private async getCatalogOrThrow(id: string) {
    const catalog = await this.prisma.catalog.findUnique({ where: { id } });
    if (!catalog) throw new NotFoundException('Katalog bulunamadı');
    return catalog;
  }

  private async getManagedMarketId(userId: string): Promise<string> {
    const mgr = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { managedMarketId: true },
    });
    if (!mgr?.managedMarketId) {
      throw new ForbiddenException('Market yöneticisi marketi tanımlı değil.');
    }
    return mgr.managedMarketId;
  }

  private isAdmin(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  }

  private async resolveMarketScope(actor: AuthenticatedUser, marketId?: string): Promise<string> {
    if (this.isAdmin(actor.role)) {
      if (!marketId) throw new BadRequestException('marketId gerekli');
      return marketId;
    }
    const managedId = await this.getManagedMarketId(actor.id);
    if (marketId && marketId !== managedId) {
      throw new ForbiddenException('Bu markete erişim yetkiniz yok.');
    }
    return managedId;
  }

  private async assertMarketAccess(marketId: string, actor: AuthenticatedUser) {
    if (this.isAdmin(actor.role)) return;
    const managedId = await this.getManagedMarketId(actor.id);
    if (marketId !== managedId) {
      throw new ForbiddenException('Yalnızca kendi marketiniz için katalog oluşturabilirsiniz.');
    }
  }

  private async assertCatalogAccess(catalogMarketId: string, actor: AuthenticatedUser) {
    if (this.isAdmin(actor.role)) return;
    const managedId = await this.getManagedMarketId(actor.id);
    if (catalogMarketId !== managedId) {
      throw new ForbiddenException('Bu katalog sizin marketinize ait değil.');
    }
  }

  private async syncPageCount(catalogId: string, extra: Record<string, unknown> = {}) {
    const count = await this.prisma.catalogPage.count({ where: { catalogId } });
    await this.prisma.catalog.update({
      where: { id: catalogId },
      data: { pageCount: count, ...extra },
    });
  }
}
