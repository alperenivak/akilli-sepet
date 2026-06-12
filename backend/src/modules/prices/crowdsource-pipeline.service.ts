// =====================================================
// Crowdsource Fiyat Pipeline
// Katmanlı otomatik işleme: güvenilir kullanıcı, konsensus, geçici yansıtma
// =====================================================

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PriceSource, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { PriceCoverageService } from './price-coverage.service';
import { ReputationService } from '../users/reputation.service';
import { reputationTrustWeight } from '../users/reputation.constants';
import {
  ABNORMAL_LOWER_RATIO,
  ABNORMAL_UPPER_RATIO,
  CONSENSUS_WINDOW_DAYS,
  CrowdsourceOutcome,
  DUPLICATE_COOLDOWN_HOURS,
  OUTCOME_MESSAGES,
  PLAUSIBLE_MIGROS_TOLERANCE,
  PROVISIONAL_MAX_CONFIDENCE,
  TRUSTED_EXISTING_TOLERANCE,
  TRUSTED_MIGROS_TOLERANCE,
  TRUSTED_USER_MIN_SCORE,
  WEIGHTED_CONSENSUS_THRESHOLD,
  WEIGHTED_CV_MAX,
} from './crowdsource.constants';

export interface PipelineResult {
  outcome: CrowdsourceOutcome;
  message: string;
  confidenceScore?: number;
  appliedToPrice: boolean;
  isAbnormal: boolean;
}

interface PriceContext {
  migrosAmount: number | null;
  existingPrice: {
    id: string;
    amount: number;
    confidenceScore: number;
    isSeedData: boolean;
    needsVerification: boolean;
    source: PriceSource;
  } | null;
}

@Injectable()
export class CrowdsourcePipelineService {
  private readonly logger = new Logger(CrowdsourcePipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priceCoverage: PriceCoverageService,
    private readonly reputation: ReputationService,
  ) {}

  async assertNotDuplicate(userId: string | null, productId: string, marketId: string) {
    if (!userId) return;
    const since = new Date(Date.now() - DUPLICATE_COOLDOWN_HOURS * 3600000);
    const dup = await this.prisma.priceSubmission.findFirst({
      where: {
        userId,
        productId,
        marketId,
        createdAt: { gte: since },
        status: { in: [SubmissionStatus.PENDING, SubmissionStatus.APPROVED] },
      },
    });
    if (dup) {
      throw new BadRequestException(
        `Bu ürün ve market için son ${DUPLICATE_COOLDOWN_HOURS} saat içinde zaten bildirim yaptınız.`,
      );
    }
  }

  detectAbnormality(amount: number, migrosAmount: number | null): boolean {
    if (!migrosAmount) return false;
    const ratio = amount / migrosAmount;
    return ratio > ABNORMAL_UPPER_RATIO || ratio < ABNORMAL_LOWER_RATIO;
  }

  isPlausible(amount: number, ctx: PriceContext): boolean {
    if (ctx.existingPrice) {
      const diff = Math.abs(amount - ctx.existingPrice.amount) / ctx.existingPrice.amount;
      if (diff <= TRUSTED_EXISTING_TOLERANCE) return true;
    }
    if (ctx.migrosAmount) {
      const diff = Math.abs(amount - ctx.migrosAmount) / ctx.migrosAmount;
      return diff <= PLAUSIBLE_MIGROS_TOLERANCE;
    }
    return true;
  }

  isTrustedFastTrack(amount: number, userScore: number, ctx: PriceContext): boolean {
    if (userScore < TRUSTED_USER_MIN_SCORE) return false;
    if (ctx.existingPrice) {
      const diff = Math.abs(amount - ctx.existingPrice.amount) / ctx.existingPrice.amount;
      if (diff <= TRUSTED_EXISTING_TOLERANCE) return true;
    }
    if (ctx.migrosAmount) {
      const diff = Math.abs(amount - ctx.migrosAmount) / ctx.migrosAmount;
      return diff <= TRUSTED_MIGROS_TOLERANCE;
    }
    return false;
  }

  async loadPriceContext(productId: string, marketId: string): Promise<PriceContext> {
    const [migrosPrice, existingPrice] = await Promise.all([
      this.prisma.price.findFirst({
        where: { productId, market: { slug: 'migros' }, isAvailable: true },
        select: { amount: true },
      }),
      this.prisma.price.findUnique({
        where: { productId_marketId: { productId, marketId } },
        select: {
          id: true, amount: true, confidenceScore: true, isSeedData: true,
          needsVerification: true, source: true,
        },
      }),
    ]);
    return {
      migrosAmount: migrosPrice?.amount ?? null,
      existingPrice: existingPrice ?? null,
    };
  }

  async processSubmission(params: {
    submissionId: string;
    productId: string;
    marketId: string;
    amount: number;
    userId: string | null;
    userScore: number;
    isAbnormal: boolean;
    productName: string;
    marketName: string;
  }): Promise<PipelineResult> {
    const { submissionId, productId, marketId, amount, userId, userScore, isAbnormal, productName, marketName } = params;

    if (isAbnormal) {
      return {
        outcome: 'ADMIN_REVIEW',
        message: OUTCOME_MESSAGES.ADMIN_REVIEW,
        appliedToPrice: false,
        isAbnormal: true,
      };
    }

    const ctx = await this.loadPriceContext(productId, marketId);

    if (userId && this.isTrustedFastTrack(amount, userScore, ctx)) {
      const confidence = Math.min(0.45 + reputationTrustWeight(userScore) * 0.12, 0.78);
      await this.applyPriceUpdate({
        productId, marketId, amount, submissionId,
        confidenceScore: confidence,
        needsVerification: false,
        approveSubmission: true,
        adminNote: 'Otomatik: güvenilir kullanıcı hızlı onay',
      });
      await this.reputation.awardSubmitApproved(userId, productName, marketName, false);
      this.logger.log(`Hızlı onay (güvenilir): ${productName} @ ${marketName}`);
      return {
        outcome: 'AUTO_APPROVED_TRUSTED',
        message: OUTCOME_MESSAGES.AUTO_APPROVED_TRUSTED,
        confidenceScore: confidence,
        appliedToPrice: true,
        isAbnormal: false,
      };
    }

    const consensus = await this.tryWeightedConsensus(productId, marketId, submissionId);
    if (consensus) {
      const awarded = new Set<string>();
      for (const sub of consensus.submissions) {
        if (!sub.userId || awarded.has(sub.userId)) continue;
        awarded.add(sub.userId);
        await this.reputation.awardSubmitApproved(sub.userId, productName, marketName, true);
      }
      await this.priceCoverage.ensureProductCoverage(productId).catch(() => undefined);
      return {
        outcome: 'AUTO_APPROVED_CONSENSUS',
        message: OUTCOME_MESSAGES.AUTO_APPROVED_CONSENSUS,
        confidenceScore: consensus.confidence,
        appliedToPrice: true,
        isAbnormal: false,
      };
    }

    if (this.isPlausible(amount, ctx)) {
      const shouldProvisional = !ctx.existingPrice
        || ctx.existingPrice.isSeedData
        || ctx.existingPrice.confidenceScore < 0.4
        || (ctx.existingPrice.needsVerification && ctx.existingPrice.source === PriceSource.CROWDSOURCE);

      if (shouldProvisional) {
        const trustBonus = userId ? (reputationTrustWeight(userScore) - 1) * 0.05 : 0;
        const pendingCount = await this.prisma.priceSubmission.count({
          where: {
            productId, marketId,
            status: SubmissionStatus.PENDING,
            isAbnormal: false,
            createdAt: { gte: new Date(Date.now() - CONSENSUS_WINDOW_DAYS * 86400000) },
          },
        });
        const confidence = Math.min(
          PROVISIONAL_MAX_CONFIDENCE,
          0.18 + pendingCount * 0.04 + trustBonus,
        );
        await this.applyPriceUpdate({
          productId, marketId, amount, submissionId,
          confidenceScore: confidence,
          needsVerification: true,
          approveSubmission: false,
        });
        return {
          outcome: 'PROVISIONAL',
          message: OUTCOME_MESSAGES.PROVISIONAL,
          confidenceScore: confidence,
          appliedToPrice: true,
          isAbnormal: false,
        };
      }
    }

    return {
      outcome: 'QUEUED',
      message: OUTCOME_MESSAGES.QUEUED,
      appliedToPrice: false,
      isAbnormal: false,
    };
  }

  /** Doğrulama oylarına göre güven skorunu güncelle */
  async applyFeedbackToConfidence(priceId: string, isCorrect: boolean) {
    const price = await this.prisma.price.findUnique({ where: { id: priceId } });
    if (!price || price.source === PriceSource.API || price.source === PriceSource.SCRAPER) return;

    const [correctCount, incorrectCount] = await Promise.all([
      this.prisma.priceFeedback.count({ where: { priceId, isCorrect: true } }),
      this.prisma.priceFeedback.count({ where: { priceId, isCorrect: false } }),
    ]);

    let next = price.confidenceScore;
    if (isCorrect) {
      next = Math.min(0.95, next + 0.06);
      if (correctCount >= 2 && incorrectCount === 0) {
        next = Math.min(0.95, next + 0.08);
      }
    } else {
      next = Math.max(0.1, next - 0.18);
    }

    const needsVerification = incorrectCount > correctCount || next < 0.35;

    await this.prisma.price.update({
      where: { id: priceId },
      data: {
        confidenceScore: next,
        needsVerification,
        ...(incorrectCount >= 2 && correctCount === 0 ? { isAvailable: false } : {}),
      },
    });
  }

  private async tryWeightedConsensus(productId: string, marketId: string, triggerId: string) {
    const since = new Date(Date.now() - CONSENSUS_WINDOW_DAYS * 86400000);
    const subs = await this.prisma.priceSubmission.findMany({
      where: {
        productId, marketId,
        status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.PENDING] },
        isAbnormal: false,
        createdAt: { gte: since },
      },
      include: { user: { select: { reputationScore: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    if (subs.length < 2) return null;

    const weighted = subs.map((s) => ({
      ...s,
      weight: s.user ? reputationTrustWeight(s.user.reputationScore) : 0.8,
    }));
    const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight < WEIGHTED_CONSENSUS_THRESHOLD) return null;

    const weightedAvg = weighted.reduce((sum, s) => sum + s.amount * s.weight, 0) / totalWeight;
    const variance = weighted.reduce(
      (sum, s) => sum + s.weight * (s.amount - weightedAvg) ** 2, 0,
    ) / totalWeight;
    const cv = Math.sqrt(variance) / weightedAvg;
    if (cv > WEIGHTED_CV_MAX) return null;

    const consensusAmount = Math.round(weightedAvg);
    const confidence = Math.min(0.25 + totalWeight * 0.12, 0.92);

    await this.applyPriceUpdate({
      productId, marketId,
      amount: consensusAmount,
      submissionId: triggerId,
      confidenceScore: confidence,
      needsVerification: false,
      approveSubmission: true,
      adminNote: `Otomatik: topluluk konsensusu (${subs.length} bildirim, ağırlık ${totalWeight.toFixed(1)})`,
      approveAllPending: true,
    });

    return { confidence, submissions: subs };
  }

  private async applyPriceUpdate(opts: {
    productId: string;
    marketId: string;
    amount: number;
    submissionId: string;
    confidenceScore: number;
    needsVerification: boolean;
    approveSubmission: boolean;
    adminNote?: string;
    approveAllPending?: boolean;
  }) {
    const {
      productId, marketId, amount, submissionId,
      confidenceScore, needsVerification, approveSubmission, adminNote, approveAllPending,
    } = opts;

    const existing = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId, marketId } },
    });

    let priceId: string;
    if (existing) {
      if (existing.amount !== amount) {
        await this.prisma.priceHistory.create({
          data: { priceId: existing.id, amount: existing.amount, source: existing.source as PriceSource },
        });
      }
      await this.prisma.price.update({
        where: { id: existing.id },
        data: {
          amount,
          source: PriceSource.CROWDSOURCE,
          isSeedData: false,
          confidenceScore,
          needsVerification,
          lastUpdated: new Date(),
        },
      });
      priceId = existing.id;
    } else {
      const created = await this.prisma.price.create({
        data: {
          productId, marketId, amount,
          source: PriceSource.CROWDSOURCE,
          isSeedData: false,
          confidenceScore,
          needsVerification,
        },
      });
      priceId = created.id;
    }

    if (approveSubmission) {
      await this.prisma.priceSubmission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.APPROVED,
          priceId,
          reviewedAt: new Date(),
          adminNote: adminNote ?? null,
        },
      });
    } else {
      await this.prisma.priceSubmission.update({
        where: { id: submissionId },
        data: { priceId },
      });
    }

    if (approveAllPending) {
      await this.prisma.priceSubmission.updateMany({
        where: {
          productId, marketId,
          status: SubmissionStatus.PENDING,
          isAbnormal: false,
        },
        data: {
          status: SubmissionStatus.APPROVED,
          priceId,
          reviewedAt: new Date(),
          adminNote: adminNote ?? 'Otomatik: topluluk konsensusu',
        },
      });
    }
  }

  async getAdminStats() {
    const [needsReview, queued, autoApproved, provisionalPrices] = await Promise.all([
      this.prisma.priceSubmission.count({
        where: { status: SubmissionStatus.PENDING, isAbnormal: true },
      }),
      this.prisma.priceSubmission.count({
        where: { status: SubmissionStatus.PENDING, isAbnormal: false },
      }),
      this.prisma.priceSubmission.count({
        where: {
          status: SubmissionStatus.APPROVED,
          adminNote: { startsWith: 'Otomatik:' },
        },
      }),
      this.prisma.price.count({
        where: {
          source: PriceSource.CROWDSOURCE,
          needsVerification: true,
          isAvailable: true,
        },
      }),
    ]);
    return { needsReview, queued, autoApproved, provisionalPrices };
  }
}
