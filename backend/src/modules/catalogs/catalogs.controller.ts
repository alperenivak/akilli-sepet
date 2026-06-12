import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiCreatedResponse, ApiNotFoundResponse, ApiQuery, ApiConsumes, ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { CatalogsService } from './catalogs.service';
import { CatalogScraperService } from './catalog-scraper.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { AddCatalogPageDto } from './dto/add-catalog-page.dto';
import { BulkAddCatalogPagesDto } from './dto/bulk-add-catalog-pages.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('catalogs')
@Controller('catalogs')
export class CatalogsController {
  constructor(
    private readonly catalogsService: CatalogsService,
    private readonly scraperService: CatalogScraperService,
  ) {}

  // ══════════════════════════════════════════════════
  // PUBLIC
  // ══════════════════════════════════════════════════

  @Public()
  @Get()
  @ApiOperation({ summary: 'Aktif kataloglar (mobil)' })
  @ApiQuery({ name: 'marketId', required: false })
  findActive(@Query('marketId') marketId?: string) {
    return this.catalogsService.findActive(marketId);
  }

  // ══════════════════════════════════════════════════
  // MARKET MANAGER + ADMIN — Yönetim listesi
  // ( :id rotasından önce tanımlanmalı )
  // ══════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Get('manager/list')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Market yöneticisi — kendi marketinin tüm katalogları' })
  @ApiQuery({ name: 'marketId', required: false, description: 'Admin için market filtresi' })
  findForManager(
    @CurrentUser() user: AuthenticatedUser,
    @Query('marketId') marketId?: string,
  ) {
    return this.catalogsService.findForManager(user, marketId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MARKET_MANAGER)
  @Post('manager/scrape')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Market yöneticisi — kendi marketinin kataloglarını otomatik çek' })
  async scrapeOwnMarket(@CurrentUser() user: AuthenticatedUser) {
    const slug = await this.catalogsService.getMarketSlugForManager(user);
    return this.scraperService.scrapeMarket(slug);
  }

  // ══════════════════════════════════════════════════
  // ADMIN — Katalog Yönetimi
  // ══════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/all')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tüm kataloglar (Admin — sayfalı)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'marketId', required: false })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('marketId') marketId?: string,
  ) {
    return this.catalogsService.findAll(parseInt(page ?? '1'), parseInt(limit ?? '20'), marketId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('admin/scrape-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tüm marketlerin kataloglarını otomatik çek' })
  scrapeAll() {
    return this.scraperService.scrapeAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('admin/scrape/:slug')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Belirli markete ait katalog çek' })
  scrapeMarket(@Param('slug') slug: string) {
    return this.scraperService.scrapeMarket(slug);
  }

  // ══════════════════════════════════════════════════
  // PUBLIC — Detay (auth opsiyonel, yönetimde ownership kontrolü)
  // ══════════════════════════════════════════════════

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Katalog detayı ve tüm sayfaları' })
  @ApiNotFoundResponse({ description: 'Katalog bulunamadı' })
  findOne(@Param('id') id: string) {
    return this.catalogsService.findOne(id);
  }

  // ══════════════════════════════════════════════════
  // ADMIN + MARKET_MANAGER — CRUD
  // ══════════════════════════════════════════════════

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Yeni katalog oluştur' })
  @ApiCreatedResponse({ description: 'Katalog oluşturuldu' })
  create(@Body() dto: CreateCatalogDto, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Katalog güncelle' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Katalog sil' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.remove(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Patch(':id/toggle-active')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Katalog aktif/pasif yap' })
  toggleActive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.toggleActive(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Patch(':id/cover-from-first-page')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kapak görselini ilk sayfadan ayarla' })
  setCoverFromFirstPage(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.catalogsService.setCoverFromFirstPage(id, user);
  }

  // ── Sayfa Yönetimi ──────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Post(':id/pages')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kataloğa sayfa ekle' })
  addPage(
    @Param('id') id: string,
    @Body() dto: AddCatalogPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.addPage(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Post(':id/pages/bulk')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kataloğa toplu sayfa ekle (URL listesi)' })
  bulkAddPages(
    @Param('id') id: string,
    @Body() dto: BulkAddCatalogPagesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.bulkAddPages(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Post(':id/upload-image')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kapak veya sayfa görseli yükle (MinIO)' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'type', enum: ['cover', 'page'], required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Sadece görsel dosyaları kabul edilir'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @Query('type') type: 'cover' | 'page',
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('Görsel dosyası gerekli');
    if (type !== 'cover' && type !== 'page') {
      throw new BadRequestException('type=cover veya type=page olmalı');
    }
    return this.catalogsService.uploadImage(id, file, type, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Delete(':id/pages/:pageId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Katalog sayfasını sil' })
  removePage(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogsService.removePage(id, pageId, user);
  }
}
