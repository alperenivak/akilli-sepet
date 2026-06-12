// =====================================================
// Veri Senkronizasyonu Servisi
// Ic veri islemleri + log + kuyruk — DIS VERI CEKMEZ
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import {
  DATA_SYNC_QUEUE_NAME, DATA_SYNC_JOB_TYPES, DATA_SYNC_PROVIDERS, DATA_SYNC_LOG_STATUS,
} from '../../constants/data-sync.constants';
import { DataProviderRegistry } from './providers/provider.registry';
import { ImportPricesByBarcodeDto } from './dto/import-prices-by-barcode.dto';
import { PricesService } from '../prices/prices.service';
import { PriceSource } from '@prisma/client';

@Injectable()
export class DataSyncService {
  private readonly logger = new Logger(DataSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly providers: DataProviderRegistry,
    private readonly pricesService: PricesService,
    @InjectQueue(DATA_SYNC_QUEUE_NAME) private readonly syncQueue: Queue,
  ) {}

  // ---- Durum & saglayicilar ----
  async getStatus() {
    const staleDays = this.config.get<number>('dataSync.priceStaleDays', 7);
    const [staleCount, totalPrices, lastLog, pendingFeedback] = await Promise.all([
      this.prisma.price.count({
        where: {
          OR: [
            { needsVerification: true },
            { lastUpdated: { lt: new Date(Date.now() - staleDays * 86400000) } },
          ],
        },
      }),
      this.prisma.price.count({ where: { isAvailable: true } }),
      this.prisma.dataSyncLog.findFirst({ orderBy: { startedAt: 'desc' } }),
      this.prisma.priceFeedback.count({
        where: { isCorrect: false, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      }),
    ]);

    return {
      cronEnabled: this.config.get<boolean>('dataSync.cronEnabled', true),
      externalProvidersEnabled: this.config.get<boolean>('dataSync.externalProvidersEnabled', false),
      providers: this.providers.getAllStatuses(),
      stats: {
        totalPrices,
        staleOrUnverified: staleCount,
        negativeFeedbackLast30d: pendingFeedback,
      },
      lastJob: lastLog,
      readyForLiveData: true,
      message: 'Ic veri altyapisi hazir. Fiyatlar manuel import veya market paneli ile yuklenebilir.',
    };
  }

  async getLogs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.dataSyncLog.findMany({ skip, take: limit, orderBy: { startedAt: 'desc' } }),
      this.prisma.dataSyncLog.count(),
    ]);
    return { items, total, page, limit };
  }

  // ---- Log yardimcilari ----
  async startLog(jobType: string, provider: string, recordsTotal = 0) {
    return this.prisma.dataSyncLog.create({
      data: {
        jobType,
        provider,
        status: DATA_SYNC_LOG_STATUS.PENDING,
        recordsTotal,
      },
    });
  }

  async completeLog(
    id: string,
    status: string,
    recordsSuccess: number,
    recordsFailed: number,
    errorMessage?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.dataSyncLog.update({
      where: { id },
      data: {
        status,
        recordsSuccess,
        recordsFailed,
        errorMessage,
        metadata: metadata as object | undefined,
        completedAt: new Date(),
      },
    });
  }

  // ---- Barkod ile toplu fiyat import (yalnizca DB eslestirme) ----
  async importPricesByBarcode(dto: ImportPricesByBarcodeDto) {
    const log = await this.startLog(
      DATA_SYNC_JOB_TYPES.PRICE_IMPORT,
      DATA_SYNC_PROVIDERS.BULK_CSV,
      dto.items.length,
    );

    let success = 0;
    let failed = 0;
    const errors: Array<{ barcode: string; marketSlug: string; reason: string }> = [];

    for (const item of dto.items) {
      try {
        const barcode = await this.prisma.barcode.findUnique({
          where: { code: item.barcode.trim() },
          select: { productId: true },
        });
        if (!barcode) {
          failed++;
          errors.push({ barcode: item.barcode, marketSlug: item.marketSlug, reason: 'Barkod bulunamadi' });
          continue;
        }

        const market = await this.prisma.market.findUnique({
          where: { slug: item.marketSlug.trim() },
          select: { id: true },
        });
        if (!market) {
          failed++;
          errors.push({ barcode: item.barcode, marketSlug: item.marketSlug, reason: 'Market bulunamadi' });
          continue;
        }

        await this.pricesService.upsertPrice({
          productId: barcode.productId,
          marketId: market.id,
          amount: item.amount,
          source: item.source ?? PriceSource.MANUAL_ADMIN,
          isAvailable: true,
        });

        await this.prisma.price.updateMany({
          where: { productId: barcode.productId, marketId: market.id },
          data: { needsVerification: false },
        });

        success++;
      } catch (err) {
        failed++;
        errors.push({
          barcode: item.barcode,
          marketSlug: item.marketSlug,
          reason: (err as Error).message,
        });
      }
    }

    const status = failed === 0
      ? DATA_SYNC_LOG_STATUS.SUCCESS
      : success > 0
        ? DATA_SYNC_LOG_STATUS.PARTIAL
        : DATA_SYNC_LOG_STATUS.FAILED;

    await this.completeLog(log.id, status, success, failed, undefined, { errors: errors.slice(0, 50) });

    return { processed: success, failed, total: dto.items.length, errors: errors.slice(0, 20) };
  }

  // ---- Eski fiyatlari isaretle (dis cekim yok) ----
  async markStalePrices(): Promise<{ marked: number }> {
    const staleDays = this.config.get<number>('dataSync.priceStaleDays', 7);
    const cutoff = new Date(Date.now() - staleDays * 86400000);

    const log = await this.startLog(DATA_SYNC_JOB_TYPES.STALE_CHECK, DATA_SYNC_PROVIDERS.MANUAL_IMPORT);

    const result = await this.prisma.price.updateMany({
      where: {
        isAvailable: true,
        needsVerification: false,
        lastUpdated: { lt: cutoff },
      },
      data: { needsVerification: true },
    });

    const status = DATA_SYNC_LOG_STATUS.SUCCESS;
    await this.completeLog(log.id, status, result.count, 0, undefined, { staleDays, cutoff: cutoff.toISOString() });
    this.logger.log(`${result.count} fiyat dogrulama bekliyor olarak isaretlendi`);
    return { marked: result.count };
  }

  // ---- Suresi dolan kataloglar ----
  async deactivateExpiredCatalogs(): Promise<{ count: number }> {
    const log = await this.startLog(DATA_SYNC_JOB_TYPES.CATALOG_EXPIRE, DATA_SYNC_PROVIDERS.MANUAL_IMPORT);

    const result = await this.prisma.catalog.updateMany({
      where: { endDate: { lt: new Date() }, isActive: true },
      data: { isActive: false },
    });

    await this.completeLog(log.id, DATA_SYNC_LOG_STATUS.SUCCESS, result.count, 0);
    return { count: result.count };
  }

  // ---- Kuyruga is ekle (ic islemler) ----
  async enqueueJob(jobType: string, provider: string, data?: Record<string, unknown>) {
    const job = await this.syncQueue.add(
      jobType,
      { jobType, provider, ...data },
      { attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: true },
    );
    return { jobId: job.id, jobType, provider, queued: true };
  }
}
