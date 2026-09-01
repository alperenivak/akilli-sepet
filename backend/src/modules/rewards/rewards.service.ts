// =====================================================
// Topluluk Ödülleri Servisi
// İtibar seviyesine göre anlaşmalı market kuponları
// =====================================================

import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { RewardCodeMode, RewardCodeSource, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import {
  getReputationLevel, getNextReputationLevel, levelProgressPercent,
  resolveEffectiveReputationScore,
} from '../users/reputation.constants';
import { STORE_USAGE_NOTICE } from './rewards.constants';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

export type RewardStatus = 'LOCKED' | 'CLAIMABLE' | 'CLAIMED' | 'DEPLETED';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  private canAutoGenerate(codeMode: RewardCodeMode) {
    return codeMode === RewardCodeMode.AUTO || codeMode === RewardCodeMode.HYBRID;
  }

  private resolveStatus(
    score: number,
    reward: { minReputation: number; codeMode: RewardCodeMode; _count: { codes: number } },
    hasClaim: boolean,
  ): RewardStatus {
    if (hasClaim) return 'CLAIMED';
    if (score < reward.minReputation) return 'LOCKED';
    const poolAvailable = reward._count.codes > 0;
    if (poolAvailable || this.canAutoGenerate(reward.codeMode)) return 'CLAIMABLE';
    return 'DEPLETED';
  }

  private buildUniqueCode(prefix: string, userId: string): string {
    const p = (prefix || 'AKS').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const userPart = userId.replace(/-/g, '').slice(-4).toUpperCase();
    const timePart = Date.now().toString(36).toUpperCase().slice(-5);
    const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
    return `${p}-${userPart}-${timePart}${rand}`;
  }

  private formatClaimResult(claim: {
    code: { code: string; expiresAt: Date | null };
    reward: {
      title: string;
      benefitText: string;
      discountLabel: string;
      instructions: string | null;
      market: { name: string; brandColor?: string | null } | null;
    };
  }, alreadyHad = false) {
    return {
      message: alreadyHad
        ? `${claim.reward.market?.name ?? 'Partner'} kuponunuz zaten hazır.`
        : `${claim.reward.market?.name ?? 'Partner'} kuponunuz hazır! Kasada kodu kullanın.`,
      code: claim.code.code,
      expiresAt: claim.code.expiresAt,
      instructions: claim.reward.instructions,
      storeUsageNotice: STORE_USAGE_NOTICE,
      alreadyClaimed: alreadyHad,
      reward: {
        title: claim.reward.title,
        benefitText: claim.reward.benefitText,
        discountLabel: claim.reward.discountLabel,
        marketName: claim.reward.market?.name,
      },
    };
  }

  async getMyRewards(userId: string) {
    const [user, eventCount, verifyCount, submitCount, approvedCount, rejectedCount] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { reputationScore: true },
      }),
      this.prisma.reputationEvent.count({ where: { userId } }),
      this.prisma.priceFeedback.count({ where: { userId } }),
      this.prisma.priceSubmission.count({ where: { userId } }),
      this.prisma.priceSubmission.count({ where: { userId, status: 'APPROVED' } }),
      this.prisma.priceSubmission.count({ where: { userId, status: 'REJECTED' } }),
    ]);
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const score = resolveEffectiveReputationScore(user.reputationScore, {
      eventCount,
      verifications: verifyCount,
      submissions: submitCount,
      approved: approvedCount,
      rejected: rejectedCount,
    });
    const level = getReputationLevel(score);
    const nextLevel = getNextReputationLevel(score);

    const [rewards, claims] = await Promise.all([
      this.prisma.communityReward.findMany({
        where: { isActive: true },
        include: {
          market: { select: { id: true, name: true, slug: true, brandColor: true, logoUrl: true } },
          _count: { select: { codes: { where: { isUsed: false } } } },
        },
        orderBy: [{ sortOrder: 'asc' }, { minReputation: 'asc' }],
      }),
      this.prisma.userRewardClaim.findMany({
        where: { userId },
        include: {
          code: { select: { code: true, expiresAt: true, source: true } },
          reward: { select: { id: true, slug: true } },
        },
      }),
    ]);

    const claimMap = new Map(claims.map((c) => [c.rewardId, c]));

    const items = rewards.map((r) => {
      const claim = claimMap.get(r.id);
      const status = this.resolveStatus(score, r, !!claim);

      const progressToUnlock = score >= r.minReputation
        ? 100
        : Math.min(100, Math.round((score / r.minReputation) * 100));

      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        benefitText: r.benefitText,
        discountLabel: r.discountLabel,
        minReputation: r.minReputation,
        levelLabel: r.levelLabel,
        levelIcon: r.levelIcon,
        instructions: r.instructions,
        codeMode: r.codeMode,
        market: r.market,
        status,
        progressPercent: progressToUnlock,
        remainingCodes: r._count.codes,
        claim: claim
          ? {
              code: claim.code.code,
              claimedAt: claim.claimedAt,
              expiresAt: claim.code.expiresAt,
              source: claim.code.source,
            }
          : null,
      };
    });

    const nextReward = items.find((r) => r.status === 'LOCKED');
    const claimableCount = items.filter((r) => r.status === 'CLAIMABLE').length;

    return {
      score,
      level: level.label,
      levelIcon: level.icon,
      nextLevel: nextLevel?.label ?? null,
      nextLevelAt: nextLevel?.min ?? null,
      progressPercent: levelProgressPercent(score),
      storeUsageNotice: STORE_USAGE_NOTICE,
      rewards: items,
      stats: {
        claimed: claims.length,
        claimable: claimableCount,
        nextRewardTitle: nextReward?.title ?? null,
        nextRewardAt: nextReward?.minReputation ?? null,
      },
      pitch: this.buildPitch(score, claimableCount, nextReward, rewards.length),
    };
  }

  private buildPitch(
    score: number,
    claimable: number,
    nextReward?: { title: string; minReputation: number; progressPercent: number },
    totalRewards = 0,
  ) {
    if (claimable > 0) {
      return `${claimable} market kuponu seni bekliyor! Hemen al ve alışverişinde kullan.`;
    }
    if (nextReward) {
      const gap = Math.max(0, nextReward.minReputation - score);
      const gapText = gap < 0.05 ? 'birkaç' : gap.toFixed(1);
      return `Fiyat doğrula ve bildir — ${gapText} itibar sonra "${nextReward.title}" kuponunu aç.`;
    }
    if (totalRewards === 0) {
      return 'Partner market kuponları yakında — fiyat doğrula ve bildirerek itibar kazan.';
    }
    return 'Tüm ödüllerin açık! Topluluk katkınla marketlerde tasarruf etmeye devam et.';
  }

  async claimReward(userId: string, rewardId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { reputationScore: true },
    });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    const reward = await this.prisma.communityReward.findUnique({
      where: { id: rewardId, isActive: true },
      include: { market: { select: { name: true } } },
    });
    if (!reward) throw new NotFoundException('Ödül bulunamadı');

    if (user.reputationScore < reward.minReputation) {
      throw new BadRequestException(
        `Bu ödül için en az ${reward.minReputation.toFixed(1)} itibar gerekli (sizin: ${user.reputationScore.toFixed(2)}).`,
      );
    }

    const existing = await this.prisma.userRewardClaim.findUnique({
      where: { userId_rewardId: { userId, rewardId } },
      include: {
        code: { select: { code: true, expiresAt: true } },
        reward: {
          select: {
            title: true, benefitText: true, discountLabel: true,
            instructions: true, market: { select: { name: true, brandColor: true } },
          },
        },
      },
    });
    if (existing) return this.formatClaimResult(existing, true);

    const claimInclude = {
      code: { select: { code: true, expiresAt: true } },
      reward: {
        select: {
          title: true, benefitText: true, discountLabel: true,
          instructions: true, market: { select: { name: true, brandColor: true } },
        },
      },
    };

    const availableCode = reward.codeMode !== RewardCodeMode.AUTO
      ? await this.prisma.rewardCouponCode.findFirst({
        where: {
          rewardId,
          isUsed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
      })
      : null;

    if (availableCode) {
      const claim = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.rewardCouponCode.updateMany({
          where: { id: availableCode.id, isUsed: false },
          data: { isUsed: true },
        });
        if (updated.count === 0) return null;

        return tx.userRewardClaim.create({
          data: { userId, rewardId, codeId: availableCode.id },
          include: claimInclude,
        });
      });
      if (claim) return this.formatClaimResult(claim);
    }

    if (!this.canAutoGenerate(reward.codeMode)) {
      throw new BadRequestException('Bu ödül için kupon stoku tükendi. Daha sonra tekrar deneyin.');
    }

    const expiresAt = reward.autoExpiresDays > 0
      ? new Date(Date.now() + reward.autoExpiresDays * 24 * 60 * 60 * 1000)
      : null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.buildUniqueCode(reward.codePrefix ?? 'AKS', userId);
      try {
        const claim = await this.prisma.$transaction(async (tx) => {
          const coupon = await tx.rewardCouponCode.create({
            data: {
              rewardId,
              code,
              isUsed: true,
              source: RewardCodeSource.AUTO,
              generatedForUserId: userId,
              expiresAt,
            },
          });
          return tx.userRewardClaim.create({
            data: { userId, rewardId, codeId: coupon.id },
            include: claimInclude,
          });
        });
        return this.formatClaimResult(claim);
      } catch {
        // Benzersiz kod çakışması — tekrar dene
      }
    }

    throw new BadRequestException('Kupon oluşturulamadı, lütfen tekrar deneyin.');
  }

  // ---- Admin / Market ----

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

  private async assertRewardAccess(rewardId: string, marketId?: string) {
    const reward = await this.prisma.communityReward.findUnique({ where: { id: rewardId } });
    if (!reward) throw new NotFoundException('Ödül bulunamadı');
    if (marketId && reward.marketId !== marketId) {
      throw new ForbiddenException('Bu ödül sizin marketinize ait değil.');
    }
    return reward;
  }

  private async enrichRewardStats(rewardId: string) {
    const [totalCodes, availableCodes, claimCount, autoClaims] = await Promise.all([
      this.prisma.rewardCouponCode.count({ where: { rewardId } }),
      this.prisma.rewardCouponCode.count({ where: { rewardId, isUsed: false } }),
      this.prisma.userRewardClaim.count({ where: { rewardId } }),
      this.prisma.rewardCouponCode.count({ where: { rewardId, source: RewardCodeSource.AUTO } }),
    ]);
    return {
      totalCodes,
      availableCodes,
      usedCodes: totalCodes - availableCodes,
      claimCount,
      autoGeneratedCodes: autoClaims,
    };
  }

  async listAllAdmin() {
    const rewards = await this.prisma.communityReward.findMany({
      include: { market: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(rewards.map(async (r) => ({
      ...r,
      ...(await this.enrichRewardStats(r.id)),
    })));
  }

  async listMarketRewards(userId: string) {
    const marketId = await this.getManagedMarketId(userId);
    const rewards = await this.prisma.communityReward.findMany({
      where: { marketId },
      include: { market: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return Promise.all(rewards.map(async (r) => ({
      ...r,
      ...(await this.enrichRewardStats(r.id)),
    })));
  }

  async createReward(dto: CreateRewardDto, actor: { role: UserRole; id: string }) {
    let marketId = dto.marketId;
    if (actor.role === UserRole.MARKET_MANAGER) {
      marketId = await this.getManagedMarketId(actor.id);
    }

    const slugTaken = await this.prisma.communityReward.findUnique({ where: { slug: dto.slug } });
    if (slugTaken) throw new BadRequestException('Bu slug zaten kullanılıyor.');

    return this.prisma.communityReward.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        benefitText: dto.benefitText,
        discountLabel: dto.discountLabel,
        minReputation: dto.minReputation,
        levelLabel: dto.levelLabel,
        levelIcon: dto.levelIcon,
        instructions: dto.instructions,
        marketId,
        codeMode: dto.codeMode ?? RewardCodeMode.HYBRID,
        codePrefix: dto.codePrefix ?? 'AKS',
        autoExpiresDays: dto.autoExpiresDays ?? 30,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { market: { select: { id: true, name: true } } },
    });
  }

  async updateReward(
    rewardId: string,
    dto: UpdateRewardDto,
    actor: { role: UserRole; id: string },
  ) {
    const marketId = actor.role === UserRole.MARKET_MANAGER
      ? await this.getManagedMarketId(actor.id)
      : undefined;
    await this.assertRewardAccess(rewardId, marketId);

    if (dto.slug) {
      const slugTaken = await this.prisma.communityReward.findFirst({
        where: { slug: dto.slug, NOT: { id: rewardId } },
      });
      if (slugTaken) throw new BadRequestException('Bu slug zaten kullanılıyor.');
    }

    if (actor.role === UserRole.MARKET_MANAGER && dto.marketId) {
      throw new ForbiddenException('Market yöneticisi market değiştiremez.');
    }

    return this.prisma.communityReward.update({
      where: { id: rewardId },
      data: {
        ...dto,
        marketId: actor.role === UserRole.MARKET_MANAGER ? undefined : dto.marketId,
      },
      include: { market: { select: { id: true, name: true } } },
    });
  }

  async listClaims(rewardId: string, actor: { role: UserRole; id: string }) {
    const marketId = actor.role === UserRole.MARKET_MANAGER
      ? await this.getManagedMarketId(actor.id)
      : undefined;
    await this.assertRewardAccess(rewardId, marketId);

    const claims = await this.prisma.userRewardClaim.findMany({
      where: { rewardId },
      include: {
        user: { select: { id: true, email: true, name: true, surname: true, reputationScore: true } },
        code: { select: { code: true, source: true, expiresAt: true, createdAt: true } },
      },
      orderBy: { claimedAt: 'desc' },
      take: 100,
    });

    return claims.map((c) => ({
      id: c.id,
      claimedAt: c.claimedAt,
      user: c.user,
      code: c.code.code,
      codeSource: c.code.source,
      expiresAt: c.code.expiresAt,
    }));
  }

  async addCodes(
    rewardId: string,
    codes: string[],
    expiresAt?: Date,
    actor?: { role: UserRole; id: string },
  ) {
    let marketId: string | undefined;
    if (actor?.role === UserRole.MARKET_MANAGER) {
      marketId = await this.getManagedMarketId(actor.id);
    }
    await this.assertRewardAccess(rewardId, marketId);

    const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
    if (normalized.length === 0) throw new BadRequestException('En az bir kupon kodu girin.');

    const result = await this.prisma.rewardCouponCode.createMany({
      data: normalized.map((code) => ({
        rewardId, code, expiresAt, source: RewardCodeSource.MANUAL,
      })),
      skipDuplicates: true,
    });

    return { added: result.count, total: normalized.length };
  }
}
