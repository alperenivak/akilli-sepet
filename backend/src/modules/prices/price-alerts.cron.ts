// =====================================================
// Fiyat Uyarısı — Saatlik kontrol ve bildirim
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PriceAlertsCronService {
  private readonly logger = new Logger(PriceAlertsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkPriceAlerts(): Promise<void> {
    const alerts = await this.prisma.priceAlert.findMany({
      where: { isActive: true, triggeredAt: null },
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { id: true, fcmToken: true } },
      },
    });

    if (alerts.length === 0) return;

    let triggered = 0;
    for (const alert of alerts) {
      const priceWhere = {
        productId: alert.productId,
        isAvailable: true,
        amount: { lte: alert.targetAmount },
        ...(alert.marketId && { marketId: alert.marketId }),
      };

      const match = await this.prisma.price.findFirst({
        where: priceWhere,
        include: { market: { select: { name: true } } },
        orderBy: { amount: 'asc' },
      });

      if (!match) continue;

      const priceStr = (match.amount / 100).toFixed(2);
      await this.notifications.sendToUser(
        alert.userId,
        'Fiyat Uyarısı',
        `${alert.product.name} hedef fiyatınıza ulaştı: ₺${priceStr} (${match.market.name})`,
        NotificationType.PRICE_ALERT,
        {
          productId: alert.productId,
          marketId: match.marketId,
          amount: String(match.amount),
        },
      );

      await this.prisma.priceAlert.update({
        where: { id: alert.id },
        data: { triggeredAt: new Date(), isActive: false },
      });
      triggered++;
    }

    if (triggered > 0) {
      this.logger.log(`${triggered} fiyat uyarısı tetiklendi`);
    }
  }
}
