// =====================================================
// Akıllı Sepet - Fiyat Servisi
// Fiyat kayit, guncelleme, gecmis ve karsilastirma
// Fiyatlar KURUS (int) olarak saklanir: 2499 = 24.99 TL
// =====================================================

import {
  Injectable, Logger, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceSource, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { enrichPriceWithFreshness } from '../../common/utils/price-freshness';
import { UpsertPriceDto } from './dto/upsert-price.dto';
import { BulkPriceDto } from './dto/bulk-price.dto';
import { PriceFeedbackDto } from './dto/price-feedback.dto';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';
import { UpdatePriceAlertDto } from './dto/update-price-alert.dto';
import { PriceAlertQueryDto } from './dto/price-alert-query.dto';
import { SubmitPriceDto } from './dto/submit-price.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { PriceCoverageService } from './price-coverage.service';
import { CrowdsourcePipelineService } from './crowdsource-pipeline.service';
import { ReputationService } from '../users/reputation.service';
import { getReputationLevel } from '../users/reputation.constants';
import { MIN_CONFIDENCE_FOR_CART } from './crowdsource.constants';

export { MIN_CONFIDENCE_FOR_CART };

const CROWDSOURCE_AUTO_APPROVE_THRESHOLD = 3;

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly priceCoverage: PriceCoverageService,
    private readonly reputation: ReputationService,
    private readonly crowdsourcePipeline: CrowdsourcePipelineService,
  ) {}

  private freshnessOpts() {
    return {
      freshDays: this.config.get<number>('dataSync.priceFreshDays', 3),
      agingDays: this.config.get<number>('dataSync.priceStaleDays', 7),
    };
  }

  // ---- Urune Ait Tum Fiyatlar (Guvenilirlik bilgisi ile) ----
  async getPricesForProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });
    if (!product) throw new NotFoundException('Urun bulunamadi');

    const prices = await this.prisma.price.findMany({
      where: { productId, isAvailable: true },
      include: {
        market: {
          select: {
            id: true, name: true, logoUrl: true,
            brandColor: true, slug: true,
          },
        },
      },
      orderBy: { amount: 'asc' },
    });

    // Her fiyat icin crowdsource submission sayisini getir
    const priceIds = prices.map((p) => p.id);
    const submissionCounts = await this.prisma.priceSubmission.groupBy({
      by: ['priceId'],
      where: {
        priceId: { in: priceIds },
        status: SubmissionStatus.APPROVED,
      },
      _count: { id: true },
    });
    const countMap = new Map(submissionCounts.map((s) => [s.priceId, s._count.id]));

    const { freshDays, agingDays } = this.freshnessOpts();
    return {
      product,
      prices: prices.map((p) => {
        const approvedCount = countMap.get(p.id) ?? 0;
        return {
          ...enrichPriceWithFreshness(p, freshDays, agingDays),
          isSeedData: p.isSeedData,
          confidenceScore: p.confidenceScore,
          needsVerification: p.needsVerification,
          reliabilityLabel: this.getReliabilityLabel(
            p.source as PriceSource, p.isSeedData, approvedCount, p.needsVerification, p.confidenceScore,
          ),
          reliabilityColor: this.getReliabilityColor(
            p.source as PriceSource, p.isSeedData, approvedCount, p.needsVerification, p.confidenceScore,
          ),
          approvedReportsCount: approvedCount,
        };
      }),
    };
  }

  // Guvenilirlik etiketi hesapla
  getReliabilityLabel(
    source: PriceSource,
    isSeedData: boolean,
    approvedCount: number,
    needsVerification = false,
    confidenceScore = 1,
  ): string {
    if (source === PriceSource.API || source === PriceSource.SCRAPER) return 'Doğrulanmış';
    if (needsVerification && confidenceScore < 0.4) return 'Geçici — topluluk doğruluyor';
    if (isSeedData && approvedCount === 0) return 'Henüz doğrulanmadı';
    if (approvedCount >= CROWDSOURCE_AUTO_APPROVE_THRESHOLD) return `${approvedCount} kişi onayladı`;
    if (approvedCount > 0) return `${approvedCount} kişi bildirdi`;
    if (source === PriceSource.CROWDSOURCE && confidenceScore >= 0.4) return 'Topluluk fiyatı';
    return 'Henüz doğrulanmadı';
  }

  getReliabilityColor(
    source: PriceSource,
    isSeedData: boolean,
    approvedCount: number,
    needsVerification = false,
    confidenceScore = 1,
  ): string {
    if (source === PriceSource.API || source === PriceSource.SCRAPER) return 'green';
    if (needsVerification && confidenceScore < 0.4) return 'orange';
    if (approvedCount >= CROWDSOURCE_AUTO_APPROVE_THRESHOLD || confidenceScore >= 0.5) return 'yellow';
    if (approvedCount > 0 || source === PriceSource.CROWDSOURCE) return 'orange';
    return 'gray';
  }

  // ---- Markete gore fiyat listesi (panel) ----
  async listByMarket(marketId: string, page = 1, limit = 50, search?: string) {
    const market = await this.prisma.market.findUnique({ where: { id: marketId } });
    if (!market) throw new NotFoundException('Market bulunamadi');

    const skip = (page - 1) * limit;
    const where = {
      marketId,
      ...(search?.trim() && {
        product: {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' as const } },
            { brand: { contains: search.trim(), mode: 'insensitive' as const } },
          ],
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.price.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: {
            select: {
              id: true, name: true, brand: true, unit: true, unitValue: true,
              imageUrl: true, description: true, slug: true,
              category: { select: { id: true, name: true, icon: true } },
              barcodes: { select: { id: true, code: true }, take: 3 },
            },
          },
        },
        orderBy: { lastUpdated: 'desc' },
      }),
      this.prisma.price.count({ where }),
    ]);

    const { freshDays, agingDays } = this.freshnessOpts();
    return {
      items: items.map((p) => enrichPriceWithFreshness(p, freshDays, agingDays)),
      total,
      page,
      limit,
      market: { id: market.id, name: market.name },
    };
  }

  // ---- Veri kalitesi ozeti (admin) ----
  async getDataQualityStats() {
    const staleDays = this.config.get<number>('dataSync.priceStaleDays', 7);
    const cutoff = new Date(Date.now() - staleDays * 86400000);
    const [total, unverified, stale, negativeFeedback, singleMarketProducts, incompleteCoverage] =
      await Promise.all([
        this.prisma.price.count({ where: { isAvailable: true } }),
        this.prisma.price.count({ where: { needsVerification: true } }),
        this.prisma.price.count({
          where: { isAvailable: true, lastUpdated: { lt: cutoff }, needsVerification: false },
        }),
        this.prisma.priceFeedback.count({
          where: { isCorrect: false, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        }),
        this.priceCoverage.countSingleMarketProducts(),
        this.priceCoverage.findProductsWithIncompleteCoverage(),
      ]);
    return {
      totalActivePrices: total,
      needsVerification: unverified,
      potentiallyStale: stale,
      negativeFeedbackLast30d: negativeFeedback,
      staleThresholdDays: staleDays,
      singleMarketProducts,
      incompleteCoverageProducts: incompleteCoverage.length,
    };
  }

  // ---- Fiyat Gecmisi (Belirli Urun + Market) ----
  async getPriceHistory(productId: string, marketId: string) {
    const price = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId, marketId } },
      include: {
        product: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
    });

    if (!price) {
      throw new NotFoundException('Bu urun/market kombinasyonu icin fiyat bulunamadi');
    }

    const PRICE_HISTORY_LIMIT = 90; // Son 90 kayit (yaklasik 3 ay gunluk veri)
    const history = await this.prisma.priceHistory.findMany({
      where: { priceId: price.id },
      orderBy: { recordedAt: 'desc' },
      take: PRICE_HISTORY_LIMIT,
    });

    return { price, history };
  }

  // ---- Fiyat Kaydet / Guncelle (Upsert) ----
  async upsertPrice(dto: UpsertPriceDto, options?: { skipCoverage?: boolean }) {
    const { productId, marketId, amount, source, isAvailable } = dto;
    const isVerifiedSource = source === PriceSource.SCRAPER || source === PriceSource.API;

    // Urun ve market varlıgini kontrol et
    const [product, market] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.market.findUnique({ where: { id: marketId } }),
    ]);
    if (!product) throw new NotFoundException('Urun bulunamadi');
    if (!market) throw new NotFoundException('Market bulunamadi');

    // Mevcut fiyati kontrol et
    const existing = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId, marketId } },
    });

    const verifiedFields = isVerifiedSource
      ? { isSeedData: false, confidenceScore: 1.0 }
      : {};

    let result;
    if (existing) {
      // Fiyat degistiyse gecmise kaydet
      if (existing.amount !== amount) {
        await this.prisma.priceHistory.create({
          data: {
            priceId: existing.id,
            amount: existing.amount,
            source: existing.source,
          },
        });
      }

      result = await this.prisma.price.update({
        where: { id: existing.id },
        data: {
          amount,
          source,
          isAvailable,
          lastUpdated: new Date(),
          needsVerification: false,
          ...verifiedFields,
        },
        include: { market: { select: { id: true, name: true } } },
      });
    } else {
      // Yeni fiyat kaydi
      result = await this.prisma.price.create({
        data: {
          productId,
          marketId,
          amount,
          source,
          isAvailable,
          needsVerification: false,
          ...verifiedFields,
        },
        include: { market: { select: { id: true, name: true } } },
      });
    }

    // Scraper toplu islemde kendi batch'ini calistirir; diger kaynaklarda aninda tamamla
    if (!options?.skipCoverage && source !== PriceSource.SCRAPER) {
      await this.priceCoverage.ensureProductCoverage(productId).catch((err) => {
        this.logger.warn(`Kapsam tamamlama hatasi (${productId}): ${(err as Error).message}`);
      });
    }

    return result;
  }

  // ---- Toplu Fiyat Guncelleme ----
  // Not: Prisma upsert create/update ayrimi dogrudan donmuyor.
  // Onceki fiyat varsa "updated", yoksa "created" sayiyoruz.
  async bulkUpsert(dto: BulkPriceDto): Promise<{ processed: number; errors: number; total: number }> {
    let processed = 0;
    let errors = 0;
    const touchedProductIds = new Set<string>();

    // Veritabani islemlerini kucuk gruplara bol (batching)
    const BATCH_SIZE = 50;
    for (let i = 0; i < dto.prices.length; i += BATCH_SIZE) {
      const batch = dto.prices.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((priceDto) => this.upsertPrice(priceDto, { skipCoverage: true })),
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          processed++;
          touchedProductIds.add(batch[idx].productId);
        } else {
          errors++;
          this.logger.warn(`Toplu fiyat guncelleme hatasi: ${(result.reason as Error)?.message}`);
        }
      });
    }

    if (touchedProductIds.size > 0) {
      await this.priceCoverage.ensureCoverageForProducts([...touchedProductIds]).catch((err) => {
        this.logger.warn(`Toplu kapsam tamamlama hatasi: ${(err as Error).message}`);
      });
    }

    return { processed, errors, total: dto.prices.length };
  }

  // ---- Fiyat Geri Bildirimi (itibar entegreli dogrulama) ----
  async submitFeedback(userId: string, dto: PriceFeedbackDto) {
    const price = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId: dto.productId, marketId: dto.marketId } },
      include: {
        product: { select: { name: true } },
        market: { select: { name: true } },
      },
    });
    if (!price) throw new NotFoundException('Bu urun/market icin fiyat bulunamadi');

    const existing = await this.prisma.priceFeedback.findUnique({
      where: { userId_priceId: { userId, priceId: price.id } },
    });
    if (existing) {
      throw new ConflictException('Bu fiyat icin zaten oy kullandiniz');
    }

    const feedback = await this.prisma.priceFeedback.create({
      data: {
        userId,
        priceId: price.id,
        isCorrect: dto.isCorrect,
        note: dto.note,
      },
    });

    const rep = dto.isCorrect
      ? await this.reputation.awardVerifyCorrect(userId, price.product.name, price.market.name)
      : await this.reputation.awardVerifyIncorrect(userId, price.product.name, price.market.name);

    await this.crowdsourcePipeline.applyFeedbackToConfidence(price.id, dto.isCorrect);

    return {
      ...feedback,
      reputation: rep,
      suggestPriceSubmit: !dto.isCorrect,
    };
  }

  // =====================================================
  // CROWDSOURCE FIYAT BILDIRIMI
  // =====================================================

  // ---- Kullanici fiyat bildirimi gonder ----
  async submitCrowdsourcePrice(userId: string | null, dto: SubmitPriceDto) {
    const [product, market, user] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: dto.productId } }),
      this.prisma.market.findUnique({ where: { id: dto.marketId } }),
      userId
        ? this.prisma.user.findUnique({ where: { id: userId }, select: { reputationScore: true } })
        : Promise.resolve(null),
    ]);
    if (!product) throw new NotFoundException('Urun bulunamadi');
    if (!market) throw new NotFoundException('Market bulunamadi');

    await this.crowdsourcePipeline.assertNotDuplicate(userId, dto.productId, dto.marketId);

    const ctx = await this.crowdsourcePipeline.loadPriceContext(dto.productId, dto.marketId);
    const isAbnormal = this.crowdsourcePipeline.detectAbnormality(dto.amount, ctx.migrosAmount);

    const submission = await this.prisma.priceSubmission.create({
      data: {
        productId: dto.productId,
        marketId: dto.marketId,
        userId: userId ?? undefined,
        amount: dto.amount,
        note: dto.note,
        isAbnormal,
        status: SubmissionStatus.PENDING,
      },
      include: {
        product: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
      },
    });

    const pipeline = await this.crowdsourcePipeline.processSubmission({
      submissionId: submission.id,
      productId: dto.productId,
      marketId: dto.marketId,
      amount: dto.amount,
      userId,
      userScore: user?.reputationScore ?? 1,
      isAbnormal,
      productName: product.name,
      marketName: market.name,
    });

    let reputation: { points: number; scoreAfter: number; level: string } | null = null;
    if (userId) {
      reputation = await this.reputation.awardSubmitPrice(userId, product.name, market.name);
    }

    if (pipeline.appliedToPrice && pipeline.outcome !== 'AUTO_APPROVED_TRUSTED') {
      await this.priceCoverage.ensureProductCoverage(dto.productId).catch((err) => {
        this.logger.warn(`Pipeline sonrasi kapsam hatasi: ${(err as Error).message}`);
      });
    }

    const repSuffix = reputation ? ` (+${reputation.points} itibar)` : '';

    return {
      ...submission,
      status: pipeline.outcome.startsWith('AUTO_APPROVED') ? SubmissionStatus.APPROVED : submission.status,
      isAbnormal,
      reputation,
      outcome: pipeline.outcome,
      confidenceScore: pipeline.confidenceScore,
      appliedToPrice: pipeline.appliedToPrice,
      message: `${pipeline.message}${repSuffix}`,
    };
  }

  /** Admin: eksik market fiyatlarini manuel tamamla */
  repairPriceCoverage() {
    return this.priceCoverage.repairIncompleteCoverage();
  }

  // ---- Admin: Bekleyen bildirimler listesi ----
  async listSubmissions(options: {
    status?: SubmissionStatus;
    page?: number;
    limit?: number;
    isAbnormal?: boolean;
    needsReview?: boolean;
  } = {}) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: { status?: SubmissionStatus; isAbnormal?: boolean; AND?: object[] } = {};
    if (options.needsReview) {
      where.status = SubmissionStatus.PENDING;
      where.isAbnormal = true;
    } else {
      if (options.status) where.status = options.status;
      if (options.isAbnormal !== undefined) where.isAbnormal = options.isAbnormal;
    }

    const [items, total, stats] = await Promise.all([
      this.prisma.priceSubmission.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, imageUrl: true, brand: true } },
          market: { select: { id: true, name: true, logoUrl: true } },
          user: { select: { id: true, name: true, surname: true, email: true, reputationScore: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ isAbnormal: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.priceSubmission.count({ where }),
      this.crowdsourcePipeline.getAdminStats(),
    ]);

    const processingLabel = (item: typeof items[0]) => {
      if (item.status === SubmissionStatus.APPROVED && item.adminNote?.startsWith('Otomatik:')) {
        return item.adminNote.replace('Otomatik: ', '');
      }
      if (item.status === SubmissionStatus.PENDING && item.isAbnormal) return 'İnceleme gerekli';
      if (item.status === SubmissionStatus.PENDING && item.priceId) return 'Geçici yansıtıldı';
      if (item.status === SubmissionStatus.PENDING) return 'Konsensus bekleniyor';
      if (item.status === SubmissionStatus.REJECTED) return 'Reddedildi';
      return 'Manuel onay';
    };

    return {
      items: items.map((item) => ({
        ...item,
        processingLabel: processingLabel(item),
        user: item.user
          ? {
              ...item.user,
              reputationLevel: getReputationLevel(item.user.reputationScore).label,
              reputationIcon: getReputationLevel(item.user.reputationScore).icon,
            }
          : null,
      })),
      total,
      page,
      limit,
      stats,
    };
  }

  // ---- Admin: Bildirimi onayla / reddet ----
  async reviewSubmission(adminId: string, submissionId: string, dto: ReviewSubmissionDto) {
    const submission = await this.prisma.priceSubmission.findUnique({
      where: { id: submissionId },
      include: {
        price: true,
        product: { select: { name: true } },
        market: { select: { name: true } },
        user: { select: { id: true } },
      },
    });
    if (!submission) throw new NotFoundException('Bildirim bulunamadi');
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new ForbiddenException('Bu bildirim zaten incelendi');
    }

    const updated = await this.prisma.priceSubmission.update({
      where: { id: submissionId },
      data: {
        status: dto.decision as unknown as SubmissionStatus,
        adminNote: dto.adminNote,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    // Onaylandiysa fiyat kaydini guncelle
    if (dto.decision === 'APPROVED') {
      await this.applyApprovedSubmission(submission.productId, submission.marketId, submission.amount, submissionId);
      if (submission.userId) {
        await this.reputation.awardSubmitApproved(
          submission.userId,
          submission.product.name,
          submission.market.name,
          false,
        );
      }
    } else if (dto.decision === 'REJECTED' && submission.userId) {
      await this.reputation.awardSubmitRejected(
        submission.userId,
        submission.product.name,
        submission.market.name,
      );
    }

    return updated;
  }

  // Onaylanan bildirimi fiyat tablosuna uygula
  private async applyApprovedSubmission(productId: string, marketId: string, amount: number, submissionId: string) {
    const existing = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId, marketId } },
    });

    // Tum onaylanan bildirimleri topla (yeni onay dahil)
    const approved = await this.prisma.priceSubmission.findMany({
      where: {
        productId,
        marketId,
        status: SubmissionStatus.APPROVED,
      },
      select: { amount: true },
    });
    const allAmounts = [...approved.map((s) => s.amount), amount];
    const avgAmount = Math.round(allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length);
    const confidenceScore = Math.min(0.2 + allAmounts.length * 0.1, 0.95);

    if (existing) {
      if (existing.amount !== avgAmount) {
        await this.prisma.priceHistory.create({
          data: { priceId: existing.id, amount: existing.amount, source: existing.source as PriceSource },
        });
      }
      const updated = await this.prisma.price.update({
        where: { id: existing.id },
        data: {
          amount: avgAmount,
          source: PriceSource.CROWDSOURCE,
          needsVerification: false,
          isSeedData: false,
          confidenceScore,
          lastUpdated: new Date(),
        },
      });
      await this.prisma.priceSubmission.update({
        where: { id: submissionId },
        data: { priceId: updated.id },
      });
    } else {
      const newPrice = await this.prisma.price.create({
        data: {
          productId,
          marketId,
          amount: avgAmount,
          source: PriceSource.CROWDSOURCE,
          confidenceScore,
          isSeedData: false,
        },
      });
      await this.prisma.priceSubmission.update({
        where: { id: submissionId },
        data: { priceId: newPrice.id },
      });
    }

    await this.priceCoverage.ensureProductCoverage(productId).catch((err) => {
      this.logger.warn(`Crowdsource sonrasi kapsam hatasi (${productId}): ${(err as Error).message}`);
    });
  }

  // ---- Fiyat Uyarısı ----
  async createAlert(userId: string, dto: CreatePriceAlertDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Urun bulunamadi');

    if (dto.marketId) {
      const market = await this.prisma.market.findUnique({ where: { id: dto.marketId } });
      if (!market) throw new NotFoundException('Market bulunamadi');
    }

    const existing = await this.prisma.priceAlert.findUnique({
      where: { userId_productId: { userId, productId: dto.productId } },
    });

    if (existing) {
      const updated = await this.prisma.priceAlert.update({
        where: { id: existing.id },
        data: {
          targetAmount: dto.targetAmount,
          marketId: dto.marketId ?? null,
          isActive: true,
          triggeredAt: null,
        },
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
          market: { select: { id: true, name: true } },
        },
      });
      return this.enrichAlerts([updated]).then((r) => r[0]);
    }

    const created = await this.prisma.priceAlert.create({
      data: {
        userId,
        productId: dto.productId,
        targetAmount: dto.targetAmount,
        marketId: dto.marketId ?? null,
      },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        market: { select: { id: true, name: true } },
      },
    });
    return this.enrichAlerts([created]).then((r) => r[0]);
  }

  async getUserAlerts(userId: string, query: PriceAlertQueryDto = {}) {
    const status = query.status ?? 'all';
    const where: {
      userId: string;
      productId?: string;
      isActive?: boolean;
      triggeredAt?: null | { not: null };
    } = { userId };

    if (query.productId) where.productId = query.productId;
    if (status === 'active') {
      where.isActive = true;
      where.triggeredAt = null;
    } else if (status === 'triggered') {
      where.triggeredAt = { not: null };
    }

    const alerts = await this.prisma.priceAlert.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, imageUrl: true, brand: true } },
        market: { select: { id: true, name: true, brandColor: true } },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return this.enrichAlerts(alerts);
  }

  async updateAlert(userId: string, alertId: string, dto: UpdatePriceAlertDto) {
    const alert = await this.prisma.priceAlert.findFirst({
      where: { id: alertId, userId },
    });
    if (!alert) throw new NotFoundException('Fiyat uyarisi bulunamadi');

    if (dto.marketId) {
      const market = await this.prisma.market.findUnique({ where: { id: dto.marketId } });
      if (!market) throw new NotFoundException('Market bulunamadi');
    }

    const updated = await this.prisma.priceAlert.update({
      where: { id: alertId },
      data: {
        ...(dto.targetAmount !== undefined ? { targetAmount: dto.targetAmount } : {}),
        ...(dto.marketId !== undefined ? { marketId: dto.marketId } : {}),
        isActive: true,
        triggeredAt: null,
      },
      include: {
        product: { select: { id: true, name: true, imageUrl: true, brand: true } },
        market: { select: { id: true, name: true, brandColor: true } },
      },
    });

    return this.enrichAlerts([updated]).then((r) => r[0]);
  }

  async deleteAlert(userId: string, alertId: string) {
    const alert = await this.prisma.priceAlert.findFirst({
      where: { id: alertId, userId },
    });
    if (!alert) throw new NotFoundException('Fiyat uyarisi bulunamadi');

    await this.prisma.priceAlert.delete({ where: { id: alertId } });
    return { success: true };
  }

  private async enrichAlerts<T extends {
    id: string;
    productId: string;
    marketId: string | null;
    targetAmount: number;
    isActive: boolean;
    triggeredAt: Date | null;
    product: { id: string; name: string; imageUrl: string | null; brand?: string | null };
    market: { id: string; name: string; brandColor?: string | null } | null;
  }>(alerts: T[]) {
    if (alerts.length === 0) return [];

    const productIds = [...new Set(alerts.map((a) => a.productId))];
    const allPrices = await this.prisma.price.findMany({
      where: { productId: { in: productIds }, isAvailable: true },
      include: { market: { select: { id: true, name: true } } },
      orderBy: { amount: 'asc' },
    });

    const pricesByProduct = new Map<string, typeof allPrices>();
    for (const price of allPrices) {
      if (!pricesByProduct.has(price.productId)) {
        pricesByProduct.set(price.productId, []);
      }
      pricesByProduct.get(price.productId)!.push(price);
    }

    return alerts.map((alert) => {
      const productPrices = pricesByProduct.get(alert.productId) ?? [];
      const scoped = alert.marketId
        ? productPrices.filter((p) => p.marketId === alert.marketId)
        : productPrices;
      const current = scoped[0] ?? null;

      return {
        ...alert,
        currentAmount: current?.amount ?? null,
        currentMarketName: current?.market?.name ?? null,
        gapAmount: current ? current.amount - alert.targetAmount : null,
        isTargetReached: current ? current.amount <= alert.targetAmount : false,
      };
    });
  }
}
