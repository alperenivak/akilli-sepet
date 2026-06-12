import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DATA_SYNC_QUEUE_NAME } from '../../constants/data-sync.constants';
import { DataSyncService } from './data-sync.service';
import { DataSyncProcessor } from './data-sync.processor';
import { DataSyncController } from './data-sync.controller';
import { DataSyncCronService } from './data-sync.cron';
import { DataProviderRegistry } from './providers/provider.registry';
import { PricesModule } from '../prices/prices.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: DATA_SYNC_QUEUE_NAME }),
    forwardRef(() => PricesModule),
  ],
  controllers: [DataSyncController],
  providers: [
    DataSyncService,
    DataSyncProcessor,
    DataSyncCronService,
    DataProviderRegistry,
  ],
  exports: [DataSyncService, DataProviderRegistry],
})
export class DataSyncModule {}
