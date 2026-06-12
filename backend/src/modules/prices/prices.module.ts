import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { PriceAlertsCronService } from './price-alerts.cron';
import { PriceCoverageService } from './price-coverage.service';
import { PriceCoverageCronService } from './price-coverage.cron';
import { CrowdsourcePipelineService } from './crowdsource-pipeline.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [NotificationsModule, UsersModule],
  controllers: [PricesController],
  providers: [
    PricesService,
    CrowdsourcePipelineService,
    PriceAlertsCronService,
    PriceCoverageService,
    PriceCoverageCronService,
  ],
  exports: [PricesService, PriceCoverageService, CrowdsourcePipelineService],
})
export class PricesModule {}
