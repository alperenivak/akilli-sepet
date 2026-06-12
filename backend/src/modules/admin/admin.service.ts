// =====================================================
// Akıllı Sepet - Admin Servisi
// Sistem geneli istatistikler ve raporlama
// =====================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ReportStatus } from '@prisma/client';
import { classifyProduct } from '../products/category-classifier';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ---- Dashboard Istatistikleri ----
  async getDashboardStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersLast30Days,
      totalProducts,
      totalMarkets,
      totalPrices,
      totalReports,
      pendingReports,
      activeCatalogs,
      priceUpdatesLast24h,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.product.count(),
      this.prisma.market.count({ where: { isActive: true } }),
      this.prisma.price.count({ where: { isAvailable: true } }),
      this.prisma.report.count(),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.catalog.count({ where: { isActive: true, endDate: { gte: now } } }),
      this.prisma.priceHistory.count({
        where: { recordedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    // En cok ihbar gelen ilk 5 market
    const topReportedMarkets = await this.prisma.report.groupBy({
      by: ['marketId'],
      where: { marketId: { not: null } },
      _count: { marketId: true },
      orderBy: { _count: { marketId: 'desc' } },
      take: 5,
    });

    // Son 7 gun kayit olan kullanicilari goster
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = await this.prisma.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      users: { total: totalUsers, newLast30Days: newUsersLast30Days, recent: recentUsers },
      products: { total: totalProducts },
      markets: { total: totalMarkets },
      prices: { total: totalPrices, updatesLast24h: priceUpdatesLast24h },
      reports: { total: totalReports, pending: pendingReports, topMarkets: topReportedMarkets },
      catalogs: { active: activeCatalogs },
      generatedAt: now.toISOString(),
    };
  }

  // ---- Veri Kalitesi Ozeti ----
  async getDataQuality() {
    const [
      totalProducts,
      activeProducts,
      withoutImage,
      withoutPrice,
      withoutBarcode,
      inactiveProducts,
      recentScraperFailures,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.product.count({
        where: { isActive: true, OR: [{ imageUrl: null }, { imageUrl: '' }] },
      }),
      this.prisma.product.count({
        where: {
          isActive: true,
          prices: { none: { isAvailable: true } },
        },
      }),
      this.prisma.product.count({
        where: { isActive: true, barcodes: { none: {} } },
      }),
      this.prisma.product.count({ where: { isActive: false } }),
      this.prisma.dataSyncLog.count({
        where: {
          status: 'failed',
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const categorySuggestions = await this.getCategoryMismatchCount();

    return {
      products: {
        total: totalProducts,
        active: activeProducts,
        inactive: inactiveProducts,
        withoutImage,
        withoutPrice,
        withoutBarcode,
        imageCoveragePct: activeProducts
          ? Math.round(((activeProducts - withoutImage) / activeProducts) * 100)
          : 100,
        priceCoveragePct: activeProducts
          ? Math.round(((activeProducts - withoutPrice) / activeProducts) * 100)
          : 100,
      },
      categoryMismatchCount: categorySuggestions,
      scraper: { failuresLast24h: recentScraperFailures },
      generatedAt: new Date().toISOString(),
    };
  }

  private async getCategoryMismatchCount(): Promise<number> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { name: true, brand: true, category: { select: { slug: true } } },
      take: 500,
    });
    let mismatches = 0;
    for (const p of products) {
      const suggested = classifyProduct(p.name, p.brand ?? '');
      if (suggested && suggested !== p.category.slug) mismatches++;
    }
    return mismatches;
  }

  // ---- Audit Log Listesi ----
  async getAuditLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { items, total, page, limit };
  }

  // ---- Scraper Log Listesi (geriye uyumluluk) ----
  async getScraperLogs(page = 1, limit = 20) {
    return this.getDataSyncLogs(page, limit);
  }

  // ---- Veri Senkronizasyon Loglari ----
  async getDataSyncLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.dataSyncLog.findMany({
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.dataSyncLog.count(),
    ]);

    return { items, total, page, limit };
  }
}
