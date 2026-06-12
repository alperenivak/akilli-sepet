// =====================================================
// Veri Senkronizasyonu Kuyruk Islemleri — yalnizca ic gorevler
// =====================================================

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { DATA_SYNC_QUEUE_NAME, DATA_SYNC_JOB_TYPES } from '../../constants/data-sync.constants';
import { DataSyncService } from './data-sync.service';
import { PricesService } from '../prices/prices.service';
import { PriceSource } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

@Processor(DATA_SYNC_QUEUE_NAME)
export class DataSyncProcessor {
  private readonly logger = new Logger(DataSyncProcessor.name);

  constructor(
    private readonly dataSync: DataSyncService,
    private readonly pricesService: PricesService,
    private readonly prisma: PrismaService,
  ) {}

  @Process(DATA_SYNC_JOB_TYPES.PRICE_UPSERT)
  async handlePriceUpsert(job: Job<{
    productId: string;
    marketId: string;
    amount: number;
    source?: PriceSource;
  }>) {
    const { productId, marketId, amount, source } = job.data;
    await this.pricesService.upsertPrice({
      productId,
      marketId,
      amount,
      source: source ?? PriceSource.MANUAL_ADMIN,
      isAvailable: true,
    });
    await this.prisma.price.updateMany({
      where: { productId, marketId },
      data: { needsVerification: false },
    });
    this.logger.debug(`Kuyruk fiyat guncellendi: ${productId} @ ${marketId}`);
  }

  @Process(DATA_SYNC_JOB_TYPES.STALE_CHECK)
  async handleStaleCheck() {
    return this.dataSync.markStalePrices();
  }

  @Process(DATA_SYNC_JOB_TYPES.CATALOG_EXPIRE)
  async handleCatalogExpire() {
    return this.dataSync.deactivateExpiredCatalogs();
  }

  @Process(DATA_SYNC_JOB_TYPES.PRODUCT_SYNC)
  async handleProductSync() {
    this.logger.warn('PRODUCT_SYNC: Harici saglayici bagli degil — is atlandi');
    return { skipped: true, reason: 'EXTERNAL_PROVIDER_NOT_CONFIGURED' };
  }
}
