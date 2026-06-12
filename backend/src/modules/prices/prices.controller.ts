import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { PriceSource, SubmissionStatus, UserRole } from '@prisma/client';
import { PricesService } from './prices.service';
import { UpsertPriceDto } from './dto/upsert-price.dto';
import { BulkPriceDto } from './dto/bulk-price.dto';
import { PriceFeedbackDto } from './dto/price-feedback.dto';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';
import { UpdatePriceAlertDto } from './dto/update-price-alert.dto';
import { PriceAlertQueryDto } from './dto/price-alert-query.dto';
import { SubmitPriceDto } from './dto/submit-price.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('prices')
@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  // ---- Market fiyat listesi (Admin / Market Yoneticisi) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Market bazli fiyat listesi' })
  listByMarket(
    @Query('marketId') marketId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.pricesService.listByMarket(marketId, page, limit, search);
  }

  // ---- Veri kalitesi (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('quality-stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Fiyat veri kalitesi ozeti' })
  getQualityStats() {
    return this.pricesService.getDataQualityStats();
  }

  // ---- Fiyat kapsami tamamlama (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('coverage/repair')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Eksik market fiyatlarini tamamla',
    description: 'Tek markette kalan urunler icin diger marketlerde seed fiyat uretir',
  })
  repairCoverage() {
    return this.pricesService.repairPriceCoverage();
  }

  // ---- Urundeki Tum Fiyatlar (Herkese Acik) ----
  @Public()
  @Get('product/:productId')
  @ApiOperation({ summary: 'Bir urundeki tum market fiyatlari' })
  @ApiNotFoundResponse({ description: 'Urun bulunamadi' })
  getPricesForProduct(@Param('productId') productId: string) {
    return this.pricesService.getPricesForProduct(productId);
  }

  // ---- Fiyat Gecmisi (Herkese Acik) ----
  @Public()
  @Get('product/:productId/market/:marketId/history')
  @ApiOperation({ summary: 'Urun/market icin fiyat gecmisi' })
  @ApiNotFoundResponse({ description: 'Fiyat kaydı bulunamadi' })
  getPriceHistory(
    @Param('productId') productId: string,
    @Param('marketId') marketId: string,
  ) {
    return this.pricesService.getPriceHistory(productId, marketId);
  }

  // ---- Fiyat Kaydet/Guncelle (Admin/Market Yoneticisi) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Fiyat ekle veya guncelle (Admin/Market Yoneticisi)',
    description: 'Fiyat kurus cinsinden girilmelidir. 24.99 TL = 2499',
  })
  upsertPrice(
    @Body() dto: UpsertPriceDto,
    @Req() req: { user: { role: UserRole } },
  ) {
    const source = dto.source ?? (
      req.user.role === UserRole.MARKET_MANAGER
        ? PriceSource.MARKET_PANEL
        : PriceSource.MANUAL_ADMIN
    );
    return this.pricesService.upsertPrice({ ...dto, source });
  }

  // ---- Toplu Fiyat Guncelleme (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('bulk')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Toplu fiyat guncelleme (maks 500 kayit)' })
  bulkUpsert(@Body() dto: BulkPriceDto) {
    const prices = dto.prices.map((p) => ({
      ...p,
      source: p.source ?? PriceSource.MANUAL_ADMIN,
    }));
    return this.pricesService.bulkUpsert({ prices });
  }

  // ---- Fiyat Geri Bildirimi (Giris Yapmis Kullanici) ----
  @UseGuards(JwtAuthGuard)
  @Post('feedback')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Fiyat dogrulugu geri bildirimi' })
  submitFeedback(@Req() req: { user: { id: string } }, @Body() dto: PriceFeedbackDto) {
    return this.pricesService.submitFeedback(req.user.id, dto);
  }

  // =====================================================
  // CROWDSOURCE FIYAT BILDIRIMI
  // =====================================================

  // ---- Kullanici fiyat bildirimi gonder ----
  @UseGuards(JwtAuthGuard)
  @Post('submit')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Crowdsource fiyat bildirimi',
    description: 'Kullanici herhangi bir marketteki urun fiyatini bildirebilir. Yeterli onay sonrasi sisteme yansir.',
  })
  submitCrowdsourcePrice(
    @Req() req: { user: { id: string } },
    @Body() dto: SubmitPriceDto,
  ) {
    return this.pricesService.submitCrowdsourcePrice(req.user.id, dto);
  }

  // ---- Admin: Bekleyen bildirimler listesi ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('submissions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crowdsource bildirimleri listesi (admin)' })
  listSubmissions(
    @Query('status') status?: SubmissionStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('isAbnormal') isAbnormal?: string,
    @Query('needsReview') needsReview?: string,
  ) {
    return this.pricesService.listSubmissions({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      isAbnormal: isAbnormal !== undefined ? isAbnormal === 'true' : undefined,
      needsReview: needsReview === 'true',
    });
  }

  // ---- Admin: Bildirimi onayla / reddet ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('submissions/:id/review')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Crowdsource bildirimini onayla veya reddet (admin)' })
  @ApiNotFoundResponse({ description: 'Bildirim bulunamadi' })
  reviewSubmission(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.pricesService.reviewSubmission(req.user.id, id, dto);
  }

  // ---- Fiyat Uyarıları ----
  @UseGuards(JwtAuthGuard)
  @Post('alerts')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Fiyat uyarisi olustur veya guncelle (urun basina bir uyari)' })
  createAlert(@Req() req: { user: { id: string } }, @Body() dto: CreatePriceAlertDto) {
    return this.pricesService.createAlert(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('alerts')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kullanicinin fiyat uyarilari (guncel fiyat ve durum bilgisi ile)' })
  getAlerts(@Req() req: { user: { id: string } }, @Query() query: PriceAlertQueryDto) {
    return this.pricesService.getUserAlerts(req.user.id, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('alerts/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Fiyat uyarisi guncelle' })
  @ApiNotFoundResponse({ description: 'Uyari bulunamadi' })
  updateAlert(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdatePriceAlertDto,
  ) {
    return this.pricesService.updateAlert(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('alerts/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Fiyat uyarisi sil' })
  @ApiNotFoundResponse({ description: 'Uyari bulunamadi' })
  deleteAlert(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.pricesService.deleteAlert(req.user.id, id);
  }
}
