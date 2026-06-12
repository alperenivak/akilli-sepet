import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CatalogsService } from './catalogs.service';
import { CatalogsController } from './catalogs.controller';
import { CatalogScraperService } from './catalog-scraper.service';
import { CatalogsCronService } from './catalogs-cron.service';
import { StorageService } from '../../common/services/storage.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [CatalogsController],
  providers: [CatalogsService, CatalogScraperService, CatalogsCronService, StorageService],
  exports: [CatalogsService, CatalogScraperService],
})
export class CatalogsModule {}
