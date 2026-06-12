// =====================================================
// AI Asistan — Canlı uygulama bağlamı (ürün + kullanıcı + konum)
// =====================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export interface ChatOptions {
  userId?: string;
  sessionId?: string;
  latitude?: number;
  longitude?: number;
}

export interface AssistantContext {
  isLoggedIn: boolean;
  userName?: string;
  userEmail?: string;
  cartItemCount: number;
  cartItems: string[];
  cartTotalEstimate?: string;
  reportCount: number;
  pendingReports: number;
  priceAlertCount: number;
  unreadNotifications: number;
  nearbyBranches: Array<{
    name: string;
    market: string;
    address: string;
    city: string;
    distanceKm: number;
    phone?: string | null;
  }>;
  activeCatalogs: string[];
  markets: string[];
  hasLocation: boolean;
}

const KM_PER_DEGREE = 111;

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(options: ChatOptions): Promise<AssistantContext> {
    const ctx: AssistantContext = {
      isLoggedIn: !!options.userId,
      cartItemCount: 0,
      cartItems: [],
      reportCount: 0,
      pendingReports: 0,
      priceAlertCount: 0,
      unreadNotifications: 0,
      nearbyBranches: [],
      activeCatalogs: [],
      markets: [],
      hasLocation: options.latitude != null && options.longitude != null,
    };

    const [user, cart, catalogs, markets] = await Promise.all([
      options.userId
        ? this.prisma.user.findUnique({
            where: { id: options.userId },
            select: { name: true, email: true },
          })
        : null,
      this.loadCart(options),
      this.prisma.catalog.findMany({
        where: { isActive: true, endDate: { gte: new Date() } },
        include: { market: { select: { name: true } } },
        orderBy: { startDate: 'desc' },
        take: 5,
      }),
      this.prisma.market.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (user) {
      ctx.userName = user.name;
      ctx.userEmail = user.email;
    }

    if (cart) {
      ctx.cartItemCount = cart.items.length;
      ctx.cartItems = cart.items.map(
        (i) => `${i.quantity}x ${i.product.name} — ${i.market.name}${i.product.brand ? ` (${i.product.brand})` : ''}`,
      );
    }

    if (options.userId) {
      const [reports, alerts, notifications] = await Promise.all([
        this.prisma.report.groupBy({
          by: ['status'],
          where: { userId: options.userId },
          _count: true,
        }),
        this.prisma.priceAlert.count({ where: { userId: options.userId, isActive: true } }),
        this.prisma.notification.count({ where: { userId: options.userId, isRead: false } }),
      ]);
      ctx.reportCount = reports.reduce((s, r) => s + r._count, 0);
      ctx.pendingReports = reports
        .filter((r) => r.status === 'PENDING' || r.status === 'UNDER_REVIEW')
        .reduce((s, r) => s + r._count, 0);
      ctx.priceAlertCount = alerts;
      ctx.unreadNotifications = notifications;
    }

    ctx.activeCatalogs = catalogs.map(
      (c) => `${c.market.name}: ${c.title}`,
    );
    ctx.markets = markets.map((m) => m.name);

    if (ctx.hasLocation) {
      ctx.nearbyBranches = await this.findNearby(
        options.latitude!,
        options.longitude!,
        10,
      );
    }

    return ctx;
  }

  formatForPrompt(ctx: AssistantContext): string {
    const lines: string[] = [
      '=== CANLI UYGULAMA VERİLERİ (buna dayanarak yanıt ver, uydurma) ===',
      `Giriş durumu: ${ctx.isLoggedIn ? `Giriş yapmış (${ctx.userName ?? 'Kullanıcı'})` : 'Misafir (giriş yapmamış)'}`,
    ];

    if (ctx.cartItemCount > 0) {
      lines.push(`Sepet: ${ctx.cartItemCount} kalem — ${ctx.cartItems.join('; ')}`);
    } else {
      lines.push('Sepet: boş');
    }

    if (ctx.isLoggedIn) {
      lines.push(`İhbarlar: toplam ${ctx.reportCount}, bekleyen ${ctx.pendingReports}`);
      lines.push(`Fiyat uyarıları: ${ctx.priceAlertCount} aktif`);
      lines.push(`Okunmamış bildirim: ${ctx.unreadNotifications}`);
    }

    if (ctx.hasLocation && ctx.nearbyBranches.length > 0) {
      lines.push('Yakın market şubeleri:');
      ctx.nearbyBranches.slice(0, 5).forEach((b) => {
        lines.push(
          `  • ${b.market} — ${b.name} (${b.distanceKm.toFixed(1)} km) — ${b.address}, ${b.city}${b.phone ? ` — Tel: ${b.phone}` : ''}`,
        );
      });
    } else if (ctx.hasLocation) {
      lines.push('Konum var ama yakın şube bulunamadı (veritabanında koordinatlı şube yok olabilir).');
    } else {
      lines.push('Konum: paylaşılmadı (yakın market sorularında konum izni iste).');
    }

    if (ctx.activeCatalogs.length > 0) {
      lines.push(`Aktif kataloglar: ${ctx.activeCatalogs.join(' | ')}`);
    }

    lines.push(`Kayıtlı market zincirleri: ${ctx.markets.join(', ')}`);

    lines.push('');
    lines.push('Uygulama özellikleri: fiyat karşılaştırma, barkod tarama, sepet optimizasyonu, SKT ihbarı, katalog okuma, fiyat uyarısı, bildirimler, profil.');
    lines.push('Sekmeler: Ana Sayfa, Ara, Marketler, Sepet, Profil. AI asistan profil ve ana sayfadan açılır.');

    return lines.join('\n');
  }

  private async loadCart(options: ChatOptions) {
    const where = options.userId
      ? { userId: options.userId }
      : options.sessionId
        ? { sessionId: options.sessionId }
        : null;
    if (!where) return null;

    return this.prisma.cart.findFirst({
      where,
      include: {
        items: {
          include: {
            product: { select: { name: true, brand: true } },
            market: { select: { name: true } },
          },
          orderBy: { addedAt: 'desc' },
          take: 15,
        },
      },
    });
  }

  private async findNearby(lat: number, lng: number, radiusKm: number) {
    const latDelta = radiusKm / KM_PER_DEGREE;
    const lngDelta = radiusKm / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));

    const branches = await this.prisma.marketBranch.findMany({
      where: {
        isActive: true,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: { market: { select: { name: true } } },
    });

    return branches
      .map((b) => ({
        name: b.name,
        market: b.market.name,
        address: b.address,
        city: b.city,
        phone: b.phone,
        distanceKm: this.haversine(lat, lng, b.latitude ?? 0, b.longitude ?? 0),
      }))
      .filter((b) => b.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 8);
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2
      + Math.cos((lat1 * Math.PI) / 180)
      * Math.cos((lat2 * Math.PI) / 180)
      * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
