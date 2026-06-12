// =====================================================
// Veri Senkronizasyonu API — admin yonetimi
// =====================================================

import { Controller, Get, Post, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DataSyncService } from './data-sync.service';
import { ImportPricesByBarcodeDto } from './dto/import-prices-by-barcode.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DATA_SYNC_JOB_TYPES, DATA_SYNC_PROVIDERS } from '../../constants/data-sync.constants';

@ApiTags('data-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
@Controller('data-sync')
export class DataSyncController {
  constructor(
    private readonly dataSync: DataSyncService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Veri altyapisi durumu ve saglayici listesi' })
  getStatus() {
    return this.dataSync.getStatus();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Senkronizasyon islem loglari' })
  getLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.dataSync.getLogs(page, limit);
  }

  @Post('import/prices-by-barcode')
  @ApiOperation({
    summary: 'Barkod + market slug ile toplu fiyat import',
    description: 'Yalnizca mevcut barkod ve market kayitlarini eslestirir. Dis kaynak cekmez.',
  })
  importPricesByBarcode(@Body() dto: ImportPricesByBarcodeDto) {
    return this.dataSync.importPricesByBarcode(dto);
  }

  @Post('maintenance/stale-check')
  @ApiOperation({ summary: 'Eski fiyatlari manuel olarak isaretle' })
  runStaleCheck() {
    return this.dataSync.markStalePrices();
  }

  @Post('maintenance/catalog-expire')
  @ApiOperation({ summary: 'Suresi dolan kataloglari pasife al' })
  runCatalogExpire() {
    return this.dataSync.deactivateExpiredCatalogs();
  }

  /** Gelecekteki dis saglayici tetikleme — simdi atlanir */
  @Post('trigger/external')
  @ApiOperation({ summary: 'Harici saglayici sync (henuz aktif degil)' })
  triggerExternal() {
    const enabled = this.config.get<boolean>('dataSync.externalProvidersEnabled', false);
    if (!enabled) {
      throw new ForbiddenException(
        'Harici veri saglayicilari kapali. DATA_SYNC_EXTERNAL_PROVIDERS_ENABLED=true yapin ve connector ekleyin.',
      );
    }
    return this.dataSync.enqueueJob(DATA_SYNC_JOB_TYPES.PRODUCT_SYNC, DATA_SYNC_PROVIDERS.EXTERNAL_API);
  }
}
