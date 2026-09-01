// =====================================================
// Itibar Servisi
// Fiyat dogrulama + fiyat bildirimi → tek itibar havuzu
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ReputationEventType } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import {
  REPUTATION_MAX,
  REPUTATION_MIN,
  REPUTATION_POINTS,
  getNextReputationLevel,
  getReputationLevel,
  levelProgressPercent,
  reputationTrustWeight,
  resolveEffectiveReputationScore,
} from './reputation.constants';

interface AwardOptions {
  userId: string;
  type: ReputationEventType;
  points: number;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Itibar puanı ekle ve olay kaydet */
  async award(options: AwardOptions): Promise<{ points: number; scoreAfter: number; level: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: options.userId },
      select: { reputationScore: true },
    });
    if (!user) return { points: 0, scoreAfter: 0, level: 'Yeni Üye' };

    const raw = user.reputationScore + options.points;
    const scoreAfter = Math.round(Math.min(REPUTATION_MAX, Math.max(REPUTATION_MIN, raw)) * 100) / 100;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: options.userId },
        data: { reputationScore: scoreAfter },
      }),
      this.prisma.reputationEvent.create({
        data: {
          userId: options.userId,
          type: options.type,
          points: options.points,
          scoreAfter,
          title: options.title,
          description: options.description,
          metadata: options.metadata as Prisma.InputJsonValue | undefined,
        },
      }),
    ]);

    const level = getReputationLevel(scoreAfter).label;
    this.logger.debug(`[itibar] ${options.userId}: ${options.type} ${options.points > 0 ? '+' : ''}${options.points} → ${scoreAfter}`);
    return { points: options.points, scoreAfter, level };
  }

  /** Fiyat dogru — basparmak yukari */
  awardVerifyCorrect(userId: string, productName: string, marketName: string) {
    return this.award({
      userId,
      type: ReputationEventType.VERIFY_CORRECT,
      points: REPUTATION_POINTS.VERIFY_CORRECT,
      title: 'Fiyat doğrulandı',
      description: `${productName} — ${marketName}`,
      metadata: { productName, marketName },
    });
  }

  /** Fiyat yanlis — basparmak asagi */
  awardVerifyIncorrect(userId: string, productName: string, marketName: string) {
    return this.award({
      userId,
      type: ReputationEventType.VERIFY_INCORRECT,
      points: REPUTATION_POINTS.VERIFY_INCORRECT,
      title: 'Yanlış fiyat işaretlendi',
      description: `${productName} — ${marketName}. Doğru fiyatı bildirerek daha fazla puan kazan!`,
      metadata: { productName, marketName },
    });
  }

  /** Yeni fiyat bildirimi */
  awardSubmitPrice(userId: string, productName: string, marketName: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_PRICE,
      points: REPUTATION_POINTS.SUBMIT_PRICE,
      title: 'Fiyat bildirimi gönderildi',
      description: `${productName} — ${marketName}`,
      metadata: { productName, marketName },
    });
  }

  /** Admin veya otomatik onay */
  awardSubmitApproved(userId: string, productName: string, marketName: string, auto = false) {
    return this.award({
      userId,
      type: auto ? ReputationEventType.SUBMIT_AUTO_APPROVED : ReputationEventType.SUBMIT_APPROVED,
      points: auto ? REPUTATION_POINTS.SUBMIT_AUTO_APPROVED : REPUTATION_POINTS.SUBMIT_APPROVED,
      title: auto ? 'Topluluk onayladı!' : 'Bildirimin onaylandı',
      description: `${productName} — ${marketName}`,
      metadata: { productName, marketName, auto },
    });
  }

  /** Admin reddi */
  awardSubmitRejected(userId: string, productName: string, marketName: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_REJECTED,
      points: REPUTATION_POINTS.SUBMIT_REJECTED,
      title: 'Bildirim reddedildi',
      description: `${productName} — ${marketName}`,
      metadata: { productName, marketName },
    });
  }

  awardSubmitBarcode(userId: string, productName: string, barcode: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_BARCODE,
      points: REPUTATION_POINTS.SUBMIT_BARCODE,
      title: 'Barkod katkısı gönderildi',
      description: `${productName} — ${barcode}`,
      metadata: { productName, barcode },
    });
  }

  awardSubmitBarcodeApproved(userId: string, productName: string, barcode: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_BARCODE_APPROVED,
      points: REPUTATION_POINTS.SUBMIT_BARCODE_APPROVED,
      title: 'Barkod katkın onaylandı!',
      description: `${productName} — ${barcode}`,
      metadata: { productName, barcode },
    });
  }

  awardSubmitBarcodeRejected(userId: string, productName: string, barcode: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_BARCODE_REJECTED,
      points: REPUTATION_POINTS.SUBMIT_BARCODE_REJECTED,
      title: 'Barkod katkısı reddedildi',
      description: `${productName} — ${barcode}`,
      metadata: { productName, barcode },
    });
  }

  awardSubmitMarketListing(userId: string, productName: string, marketName: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_MARKET_LISTING,
      points: REPUTATION_POINTS.SUBMIT_MARKET_LISTING,
      title: 'Markete ekleme talebi gönderildi',
      description: `${productName} — ${marketName}`,
      metadata: { productName, marketName },
    });
  }

  awardSubmitMarketListingApproved(userId: string, productName: string, marketName: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_MARKET_LISTING_APPROVED,
      points: REPUTATION_POINTS.SUBMIT_MARKET_LISTING_APPROVED,
      title: 'Ürün markete eklendi!',
      description: `${productName} artık ${marketName} listesinde`,
      metadata: { productName, marketName },
    });
  }

  awardSubmitMarketListingRejected(userId: string, productName: string, marketName: string) {
    return this.award({
      userId,
      type: ReputationEventType.SUBMIT_MARKET_LISTING_REJECTED,
      points: REPUTATION_POINTS.SUBMIT_MARKET_LISTING_REJECTED,
      title: 'Markete ekleme reddedildi',
      description: `${productName} — ${marketName}`,
      metadata: { productName, marketName },
    });
  }

  /** Mobil profil: itibar ozeti */
  async getProfile(userId: string) {
    const [user, events, verifyCount, submitCount, approvedCount, rejectedCount, contribCount, contribApproved] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { reputationScore: true },
      }),
      this.prisma.reputationEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true, type: true, points: true, scoreAfter: true,
          title: true, description: true, createdAt: true,
        },
      }),
      this.prisma.priceFeedback.count({ where: { userId } }),
      this.prisma.priceSubmission.count({ where: { userId } }),
      this.prisma.priceSubmission.count({ where: { userId, status: 'APPROVED' } }),
      this.prisma.priceSubmission.count({ where: { userId, status: 'REJECTED' } }),
      this.prisma.productContribution.count({ where: { userId } }),
      this.prisma.productContribution.count({ where: { userId, status: 'APPROVED' } }),
    ]);

    const storedScore = user?.reputationScore ?? REPUTATION_MIN;
    const score = resolveEffectiveReputationScore(storedScore, {
      eventCount: events.length,
      verifications: verifyCount,
      submissions: submitCount + contribCount,
      approved: approvedCount + contribApproved,
      rejected: rejectedCount,
    });
    const level = getReputationLevel(score);
    const next = getNextReputationLevel(score);

    return {
      score,
      level: level.label,
      levelIcon: level.icon,
      levelColor: level.color,
      levelPerk: level.perk,
      trustWeight: reputationTrustWeight(score),
      nextLevel: next?.label ?? null,
      nextLevelAt: next?.min ?? null,
      progressPercent: levelProgressPercent(score),
      stats: {
        verifications: verifyCount,
        submissions: submitCount,
        contributions: contribCount,
        approved: approvedCount + contribApproved,
        rejected: rejectedCount,
      },
      recentEvents: events,
      engagementTips: [
        'Ürünü markette bulduysan barkodunu ekle → +0.10 itibar (onay +0.35)',
        'Sistemde olmayan ürünü markete ekle → +0.12 itibar (onay +0.40)',
        'Marketten gördüğün fiyatı bildir → +0.08 itibar',
        'Doğru fiyatlara ✓ bas → +0.05 itibar',
      ],
    };
  }
}
