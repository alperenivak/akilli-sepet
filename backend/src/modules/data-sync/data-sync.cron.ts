// =====================================================
// Veri bakim cron'lari — dis veri cekimi YOK
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSyncService } from './data-sync.service';
import { DATA_SYNC_JOB_TYPES, DATA_SYNC_PROVIDERS } from '../../constants/data-sync.constants';

@Injectable()
export class DataSyncCronService {
  private readonly logger = new Logger(DataSyncCronService.name);

  constructor(
    private readonly dataSync: DataSyncService,
    private readonly config: ConfigService,
  ) {}

  private cronEnabled(): boolean {
    return this.config.get<boolean>('dataSync.cronEnabled', true);
  }

  /** Her gun 04:00 — eski fiyatlari dogrulama bekliyor olarak isaretle (scraper 03:00) */
  @Cron('0 4 * * *')
  async nightlyStaleCheck() {
    if (!this.cronEnabled()) return;
    this.logger.log('Eski fiyat kontrolu baslatiliyor...');
    await this.dataSync.enqueueJob(DATA_SYNC_JOB_TYPES.STALE_CHECK, DATA_SYNC_PROVIDERS.MANUAL_IMPORT);
  }

  /** Her 6 saatte — suresi dolan kataloglari pasife al */
  @Cron(CronExpression.EVERY_6_HOURS)
  async catalogExpireCheck() {
    if (!this.cronEnabled()) return;
    await this.dataSync.enqueueJob(DATA_SYNC_JOB_TYPES.CATALOG_EXPIRE, DATA_SYNC_PROVIDERS.MANUAL_IMPORT);
  }
}
