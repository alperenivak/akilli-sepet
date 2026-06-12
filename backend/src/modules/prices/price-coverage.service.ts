// =====================================================
// Fiyat Kapsami Servisi
// Hicbir urunun tek markette kalmasini engeller.
// Eksik marketler icin otomatik seed fiyat uretir.
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { PriceSource } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { SEED_CONFIDENCE_SCORE } from './constants/market-price-factors';
import {
  computeReferenceMigrosEquivalent,
  estimateSeedAmount,
  type PriceReference,
} from './utils/price-coverage.util';

export interface CoverageRepairResult {
  productsChecked: number;
  productsFixed: number;
  pricesCreated: number;
  pricesUpdated: number;
}

@Injectable()
export class PriceCoverageService {
  private readonly logger = new Logger(PriceCoverageService.name);
  private marketsCache: Array<{ id: string; slug: string; name: string }> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Aktif market listesini cache'le */
  private async getActiveMarkets() {
    if (!this.marketsCache) {
      this.marketsCache = await this.prisma.market.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true },
        orderBy: { name: 'asc' },
      });
    }
    return this.marketsCache;
  }

  clearMarketsCache() {
    this.marketsCache = null;
  }

  /**
   * Tek urun icin eksik market fiyatlarini doldur.
   * Gercek (non-seed) fiyatlar asla ezilmez.
   */
  async ensureProductCoverage(productId: string): Promise<{ filled: number }> {
    const markets = await this.getActiveMarkets();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: {
        id: true,
        prices: {
          where: { isAvailable: true },
          select: {
            marketId: true,
            amount: true,
            discountedAmount: true,
            isSeedData: true,
            market: { select: { slug: true } },
          },
        },
      },
    });

    if (!product || product.prices.length === 0) return { filled: 0 };

    const existingMarketIds = new Set(product.prices.map((p) => p.marketId));
    const missingMarkets = markets.filter((m) => !existingMarketIds.has(m.id));
    if (missingMarkets.length === 0) return { filled: 0 };

    const refs: PriceReference[] = product.prices.map((p) => ({
      amount: p.amount,
      discountedAmount: p.discountedAmount,
      isSeedData: p.isSeedData,
      marketSlug: p.market.slug,
    }));
    const migrosEq = computeReferenceMigrosEquivalent(refs);
    if (migrosEq === null) return { filled: 0 };

    let filled = 0;
    for (const market of missingMarkets) {
      const seedAmount = estimateSeedAmount(migrosEq, market.slug);
      const result = await this.upsertSeedPrice(productId, market.id, seedAmount);
      if (result === 'created' || result === 'updated') filled++;
    }

    if (filled > 0) {
      this.logger.debug(`[coverage] ${productId}: ${filled} eksik market fiyati eklendi`);
    }
    return { filled };
  }

  /** Birden fazla urun icin toplu kapsam tamamlama */
  async ensureCoverageForProducts(productIds: string[]): Promise<CoverageRepairResult> {
    const unique = [...new Set(productIds)];
    const result: CoverageRepairResult = {
      productsChecked: unique.length,
      productsFixed: 0,
      pricesCreated: 0,
      pricesUpdated: 0,
    };

    for (const productId of unique) {
      const before = await this.countProductMarkets(productId);
      const { filled } = await this.ensureProductCoverage(productId);
      if (filled > 0) {
        result.productsFixed++;
        const after = await this.countProductMarkets(productId);
        result.pricesCreated += Math.max(0, after - before);
      }
    }

    return result;
  }

  /**
   * Tum aktif urunlerde eksik market fiyatlarini tarar ve doldurur.
   * Cron ve manuel bakim icin.
   */
  async repairIncompleteCoverage(): Promise<CoverageRepairResult> {
    const incomplete = await this.findProductsWithIncompleteCoverage();
    this.logger.log(`[coverage] ${incomplete.length} eksik kapsamli urun bulundu`);

    const result: CoverageRepairResult = {
      productsChecked: incomplete.length,
      productsFixed: 0,
      pricesCreated: 0,
      pricesUpdated: 0,
    };

    for (const productId of incomplete) {
      const before = await this.countProductMarkets(productId);
      const { filled } = await this.ensureProductCoverage(productId);
      if (filled > 0) {
        result.productsFixed++;
        const after = await this.countProductMarkets(productId);
        result.pricesCreated += Math.max(0, after - before);
        result.pricesUpdated += filled - Math.max(0, after - before);
      }
    }

    this.logger.log(
      `[coverage] Tamamlandi — ${result.productsFixed}/${result.productsChecked} urun, `
      + `${result.pricesCreated} yeni fiyat`,
    );
    return result;
  }

  /** Eksik marketi olan urun ID listesi */
  async findProductsWithIncompleteCoverage(): Promise<string[]> {
    const markets = await this.getActiveMarkets();
    const expectedCount = markets.length;
    if (expectedCount === 0) return [];

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id
      FROM products p
      WHERE p."isActive" = true
      AND (
        SELECT COUNT(*)::int
        FROM prices pr
        WHERE pr."productId" = p.id AND pr."isAvailable" = true
      ) < ${expectedCount}
      AND EXISTS (
        SELECT 1 FROM prices pr2
        WHERE pr2."productId" = p.id AND pr2."isAvailable" = true
      )
    `;
    return rows.map((r) => r.id);
  }

  /** Tek markette kalan urun sayisi (izleme) */
  async countSingleMarketProducts(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::int as count FROM (
        SELECT p.id FROM products p
        JOIN prices pr ON pr."productId" = p.id AND pr."isAvailable" = true
        WHERE p."isActive" = true
        GROUP BY p.id
        HAVING COUNT(pr.id) = 1
      ) sub
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private async countProductMarkets(productId: string): Promise<number> {
    return this.prisma.price.count({
      where: { productId, isAvailable: true },
    });
  }

  private async upsertSeedPrice(
    productId: string,
    marketId: string,
    seedAmount: number,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const existing = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId, marketId } },
      select: { id: true, isSeedData: true },
    });

    if (existing && !existing.isSeedData) return 'skipped';

    if (existing?.isSeedData) {
      await this.prisma.price.update({
        where: { id: existing.id },
        data: {
          amount: seedAmount,
          source: PriceSource.MANUAL_ADMIN,
          isSeedData: true,
          confidenceScore: SEED_CONFIDENCE_SCORE,
          needsVerification: false,
          lastUpdated: new Date(),
        },
      });
      return 'updated';
    }

    await this.prisma.price.create({
      data: {
        productId,
        marketId,
        amount: seedAmount,
        source: PriceSource.MANUAL_ADMIN,
        isSeedData: true,
        confidenceScore: SEED_CONFIDENCE_SCORE,
        needsVerification: false,
        isAvailable: true,
      },
    });
    return 'created';
  }
}
