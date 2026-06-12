// =====================================================
// Akıllı Sepet - Rol Bazlı İstatistik Servisi
// =====================================================

import { ForbiddenException, Injectable } from '@nestjs/common';
import { ReportStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sistem yöneticisi — tüm ekosistem istatistikleri */
  async getAdminStatistics() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    const [
      usersByRole,
      totalProducts,
      activeProducts,
      totalMarkets,
      totalBranches,
      totalPrices,
      stalePrices,
      priceUpdates24h,
      reportStatusCounts,
      activeCatalogs,
      totalInspectors,
      totalMarketManagers,
      reportsLast7Days,
      priceUpdatesLast7Days,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.market.count({ where: { isActive: true } }),
      this.prisma.marketBranch.count({ where: { isActive: true } }),
      this.prisma.price.count({ where: { isAvailable: true } }),
      this.prisma.price.count({ where: { isAvailable: true, lastUpdated: { lt: staleThreshold } } }),
      this.prisma.priceHistory.count({ where: { recordedAt: { gte: dayAgo } } }),
      this.getReportStatusCounts(),
      this.prisma.catalog.count({ where: { isActive: true, endDate: { gte: now } } }),
      this.prisma.user.count({ where: { role: UserRole.INSPECTOR, isActive: true } }),
      this.prisma.user.count({ where: { role: UserRole.MARKET_MANAGER, isActive: true } }),
      this.reportsPerDay(weekAgo),
      this.priceUpdatesPerDay(weekAgo),
    ]);

    const [topReportedMarkets, topCategories, inspectorPerformance, marketPriceCoverage] =
      await Promise.all([
        this.topMarketsByReports(5),
        this.topCategoriesInReports(5),
        this.inspectorLeaderboard(5),
        this.marketPriceCoverage(),
      ]);

    return {
      scope: 'admin',
      generatedAt: now.toISOString(),
      overview: {
        totalUsers: usersByRole.reduce((s, r) => s + r._count.role, 0),
        activeProducts,
        totalProducts,
        totalMarkets,
        totalBranches,
        totalPrices,
        stalePrices,
        activeCatalogs,
        totalInspectors,
        totalMarketManagers,
        priceUpdates24h,
      },
      users: {
        byRole: usersByRole.map((r) => ({ role: r.role, count: r._count.role })),
        newLast30Days: await this.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      },
      reports: {
        ...reportStatusCounts,
        last7DaysTrend: reportsLast7Days,
        topMarkets: topReportedMarkets,
        topCategories,
        pushedToMarket: await this.prisma.report.count({ where: { pushedToMarketAt: { not: null } } }),
      },
      prices: {
        total: totalPrices,
        stale: stalePrices,
        updatesLast24h: priceUpdates24h,
        last7DaysTrend: priceUpdatesLast7Days,
        marketCoverage: marketPriceCoverage,
      },
      inspectors: {
        active: totalInspectors,
        leaderboard: inspectorPerformance,
      },
    };
  }

  /** Denetçi — ihbar inceleme istatistikleri */
  async getInspectorStatistics(user: AuthenticatedUser) {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const globalCounts = await this.getReportStatusCounts();
    const myReviewedFilter = { reviewedById: user.id };

    const [
      reviewedToday,
      reviewedThisWeek,
      myApproved,
      myRejected,
      myUnderReview,
      myPushed,
      withPhotos,
      urgentExpiry,
    ] = await Promise.all([
      this.prisma.report.count({
        where: { ...myReviewedFilter, updatedAt: { gte: dayStart }, status: { in: [ReportStatus.APPROVED, ReportStatus.REJECTED, ReportStatus.RESOLVED] } },
      }),
      this.prisma.report.count({
        where: { ...myReviewedFilter, updatedAt: { gte: weekAgo } },
      }),
      this.prisma.report.count({ where: { ...myReviewedFilter, status: ReportStatus.APPROVED } }),
      this.prisma.report.count({ where: { ...myReviewedFilter, status: ReportStatus.REJECTED } }),
      this.prisma.report.count({ where: { ...myReviewedFilter, status: ReportStatus.UNDER_REVIEW } }),
      this.prisma.report.count({ where: { pushedById: user.id } }),
      this.prisma.report.count({ where: { images: { some: {} } } }),
      this.prisma.report.count({
        where: {
          status: { in: [ReportStatus.PENDING, ReportStatus.UNDER_REVIEW] },
          expiryDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const [topMarkets, categoryBreakdown, queueTrend] = await Promise.all([
      this.topMarketsByReports(5),
      this.topCategoriesInReports(6),
      this.reportsPerDay(weekAgo),
    ]);

    const myTotalReviewed = myApproved + myRejected +
      await this.prisma.report.count({ where: { ...myReviewedFilter, status: ReportStatus.RESOLVED } });

    return {
      scope: 'inspector',
      generatedAt: now.toISOString(),
      queue: globalCounts,
      myPerformance: {
        reviewedToday,
        reviewedThisWeek,
        totalReviewed: myTotalReviewed,
        approved: myApproved,
        rejected: myRejected,
        underReview: myUnderReview,
        pushedToMarket: myPushed,
        approvalRate: myTotalReviewed > 0 ? Math.round((myApproved / myTotalReviewed) * 100) : 0,
      },
      insights: {
        withPhotos,
        urgentExpiry,
        topMarkets,
        categoryBreakdown,
        last7DaysTrend: queueTrend,
      },
    };
  }

  /** Market yöneticisi — kendi marketine özel ürün/fiyat/ihbar istatistikleri */
  async getMarketStatistics(user: AuthenticatedUser) {
    const mgr = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { managedMarketId: true, managedMarket: { select: { id: true, name: true, brandColor: true, slug: true } } },
    });

    if (!mgr?.managedMarketId) {
      throw new ForbiddenException('Market yoneticisi market atamasi bulunamadi');
    }

    const marketId = mgr.managedMarketId;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    const [
      totalSystemProducts,
      pricedProducts,
      stalePrices,
      priceUpdatesWeek,
      branchCount,
      activeCatalogs,
      reportCounts,
      pushedReports,
    ] = await Promise.all([
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.price.count({ where: { marketId, isAvailable: true } }),
      this.prisma.price.count({ where: { marketId, isAvailable: true, lastUpdated: { lt: staleThreshold } } }),
      this.prisma.priceHistory.count({
        where: { recordedAt: { gte: weekAgo }, price: { marketId } },
      }),
      this.prisma.marketBranch.count({ where: { marketId, isActive: true } }),
      this.prisma.catalog.count({ where: { marketId, isActive: true, endDate: { gte: now } } }),
      this.getReportStatusCounts(marketId),
      this.prisma.report.count({ where: { marketId, pushedToMarketAt: { not: null } } }),
    ]);

    const missingPrices = Math.max(0, totalSystemProducts - pricedProducts);
    const coveragePercent = totalSystemProducts > 0
      ? Math.round((pricedProducts / totalSystemProducts) * 100)
      : 0;

    const [topReportedProducts, categoryPricing, reportsTrend] = await Promise.all([
      this.topProductsByReports(marketId, 5),
      this.marketCategoryPricing(marketId),
      this.reportsPerDay(weekAgo, marketId),
    ]);

    const avgPrice = await this.prisma.price.aggregate({
      where: { marketId, isAvailable: true },
      _avg: { amount: true },
    });

    return {
      scope: 'market',
      generatedAt: now.toISOString(),
      market: mgr.managedMarket,
      products: {
        totalInCatalog: totalSystemProducts,
        withPrice: pricedProducts,
        missingPrice: missingPrices,
        coveragePercent,
        stalePrices,
        priceUpdatesThisWeek: priceUpdatesWeek,
        avgPriceKurus: Math.round(avgPrice._avg.amount ?? 0),
      },
      operations: {
        branches: branchCount,
        activeCatalogs,
      },
      reports: {
        ...reportCounts,
        pushedToMarket: pushedReports,
        last7DaysTrend: reportsTrend,
        topProducts: topReportedProducts,
      },
      categoryPricing,
    };
  }

  // ---- Yardımcılar ----

  private async getReportStatusCounts(marketId?: string) {
    const base = marketId ? { marketId } : {};
    const [total, pending, underReview, approved, rejected, resolved] = await Promise.all([
      this.prisma.report.count({ where: base }),
      this.prisma.report.count({ where: { ...base, status: ReportStatus.PENDING } }),
      this.prisma.report.count({ where: { ...base, status: ReportStatus.UNDER_REVIEW } }),
      this.prisma.report.count({ where: { ...base, status: ReportStatus.APPROVED } }),
      this.prisma.report.count({ where: { ...base, status: ReportStatus.REJECTED } }),
      this.prisma.report.count({ where: { ...base, status: ReportStatus.RESOLVED } }),
    ]);
    return { total, pending, underReview, approved, rejected, resolved };
  }

  private async topMarketsByReports(take: number) {
    const grouped = await this.prisma.report.groupBy({
      by: ['marketId'],
      where: { marketId: { not: null } },
      _count: { marketId: true },
      orderBy: { _count: { marketId: 'desc' } },
      take,
    });

    const markets = await this.prisma.market.findMany({
      where: { id: { in: grouped.map((g) => g.marketId!).filter(Boolean) } },
      select: { id: true, name: true, brandColor: true },
    });

    return grouped.map((g) => ({
      marketId: g.marketId,
      count: g._count.marketId,
      market: markets.find((m) => m.id === g.marketId) ?? null,
    }));
  }

  private async topCategoriesInReports(take: number) {
    const reports = await this.prisma.report.findMany({
      where: { productId: { not: null } },
      select: { product: { select: { categoryId: true, category: { select: { id: true, name: true, icon: true } } } } },
      take: 500,
    });

    const map = new Map<string, { category: { id: string; name: string; icon: string | null }; count: number }>();
    for (const r of reports) {
      const cat = r.product?.category;
      if (!cat) continue;
      const existing = map.get(cat.id);
      if (existing) existing.count++;
      else map.set(cat.id, { category: cat, count: 1 });
    }

    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, take);
  }

  private async inspectorLeaderboard(take: number) {
    const grouped = await this.prisma.report.groupBy({
      by: ['reviewedById'],
      where: { reviewedById: { not: null } },
      _count: { reviewedById: true },
      orderBy: { _count: { reviewedById: 'desc' } },
      take,
    });

    const users = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.reviewedById!).filter(Boolean) } },
      select: { id: true, name: true, surname: true, email: true },
    });

    return grouped.map((g) => {
      const u = users.find((x) => x.id === g.reviewedById);
      return {
        inspectorId: g.reviewedById,
        reviewedCount: g._count.reviewedById,
        name: u ? `${u.name} ${u.surname}` : 'Bilinmiyor',
      };
    });
  }

  private async marketPriceCoverage() {
    const markets = await this.prisma.market.findMany({
      where: { isActive: true },
      select: { id: true, name: true, brandColor: true },
      take: 10,
    });

    const totalProducts = await this.prisma.product.count({ where: { isActive: true } });

    const result = await Promise.all(
      markets.map(async (m) => {
        const priced = await this.prisma.price.count({ where: { marketId: m.id, isAvailable: true } });
        return {
          marketId: m.id,
          name: m.name,
          brandColor: m.brandColor,
          pricedCount: priced,
          coveragePercent: totalProducts > 0 ? Math.round((priced / totalProducts) * 100) : 0,
        };
      }),
    );

    return result.sort((a, b) => b.coveragePercent - a.coveragePercent);
  }

  private async topProductsByReports(marketId: string, take: number) {
    const grouped = await this.prisma.report.groupBy({
      by: ['productId'],
      where: { marketId, productId: { not: null } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take,
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((g) => g.productId!).filter(Boolean) } },
      select: { id: true, name: true, brand: true },
    });

    return grouped.map((g) => ({
      productId: g.productId,
      count: g._count.productId,
      product: products.find((p) => p.id === g.productId) ?? null,
    }));
  }

  private async marketCategoryPricing(marketId: string) {
    const prices = await this.prisma.price.findMany({
      where: { marketId, isAvailable: true },
      select: { product: { select: { category: { select: { id: true, name: true, icon: true } } } } },
      take: 500,
    });

    const map = new Map<string, { category: { id: string; name: string; icon: string | null }; count: number }>();
    for (const p of prices) {
      const cat = p.product?.category;
      if (!cat) continue;
      const existing = map.get(cat.id);
      if (existing) existing.count++;
      else map.set(cat.id, { category: cat, count: 1 });
    }

    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }

  private async reportsPerDay(since: Date, marketId?: string) {
    const reports = await this.prisma.report.findMany({
      where: {
        createdAt: { gte: since },
        ...(marketId ? { marketId } : {}),
      },
      select: { createdAt: true },
    });

    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    for (const r of reports) {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (key in days) days[key]++;
    }
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }

  private async priceUpdatesPerDay(since: Date) {
    const rows = await this.prisma.priceHistory.findMany({
      where: { recordedAt: { gte: since } },
      select: { recordedAt: true },
    });

    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    for (const r of rows) {
      const key = r.recordedAt.toISOString().slice(0, 10);
      if (key in days) days[key]++;
    }
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }
}
