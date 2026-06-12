// =====================================================
// Akıllı Sepet - Urun Controller'i
// Herkese acik: listeleme, detay, barkod
// Korunan: olusturma, guncelleme (Admin)
// =====================================================

import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards, ParseBoolPipe, DefaultValuePipe, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { AddBarcodeDto } from './dto/add-barcode.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ---- Urun Ozet Istatistikleri (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Urun ozet istatistikleri: toplam, aktif, SKT yakin (Admin)' })
  @ApiOkResponse({ description: '{ total, active, inactive, sktNearby30 }' })
  getStats() {
    return this.productsService.getStats();
  }

  // ---- Kategori Uyumsuzluk Onerileri (Admin / Market Yoneticisi) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Get('category-suggestions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Yanlis kategorize edilmis urunlerin oneri listesi' })
  @ApiOkResponse({ description: '{ total, mismatchCount, suggestions[] }' })
  getCategorySuggestions(@Req() req: { user: { id: string; role: UserRole } }) {
    return this.productsService.getCategorySuggestions(req.user);
  }

  // ---- Kategori Duzeltme Uygula (Admin / Market Yoneticisi) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Post('apply-categories')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Secilen urunlerin kategorilerini toplu guncelle' })
  @ApiOkResponse({ description: '{ updated: number }' })
  applyCategories(
    @Body() body: { fixes: Array<{ productId: string; categoryId: string }> },
    @Req() req: { user: { id: string; role: UserRole } },
  ) {
    return this.productsService.applyCategories(body.fixes ?? [], req.user);
  }

  // ---- Kategoriler (Herkese Acik) ----
  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Urun kategorilerini listele (varsayilan: agac yapisi)' })
  @ApiOkResponse({ description: 'Kategori agaci veya duz liste (flat=true)' })
  getCategories(
    @Query('flat', new DefaultValuePipe(false), ParseBoolPipe) flat: boolean,
  ) {
    return this.productsService.findCategories(flat);
  }

  // ---- Barkod ile Urun Bul (Herkese Acik) ----
  @Public()
  @Get('barcode/:code')
  @ApiOperation({ summary: 'Barkod ile urun bul' })
  @ApiNotFoundResponse({ description: 'Barkoda ait urun bulunamadi' })
  findByBarcode(@Param('code') code: string) {
    return this.productsService.findByBarcode(code);
  }

  // ---- Urun Listele (Herkese Acik) ----
  @Public()
  @Get()
  @ApiOperation({ summary: 'Urunleri listele (arama + filtre + sayfalama)' })
  @ApiOkResponse({ description: 'Sayfalanmis urun listesi: { items, total, page, limit, totalPages, hasNext }' })
  findAll(@Query() filter: ProductFilterDto) {
    return this.productsService.findAll(filter);
  }

  // ---- Iliskili Urunler (Herkese Acik) ----
  @Public()
  @Get(':id/related')
  @ApiOperation({ summary: 'Iliskili urunler (sepet birlikteligi + kategori)' })
  findRelated(@Param('id') id: string) {
    return this.productsService.findRelated(id);
  }

  // ---- Urun Detayi (Herkese Acik) ----
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Urun detayi ve tum marketteki fiyatlar' })
  @ApiOkResponse({ description: 'Urun detayi, barkodlar, kategoriler ve marketteki fiyatlar' })
  @ApiNotFoundResponse({ description: 'Urun bulunamadi' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // ---- Urun Olustur (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Yeni urun olustur (Admin)' })
  @ApiCreatedResponse({ description: 'Urun olusturuldu' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // ---- Urun Guncelle (Admin / Market Yoneticisi — kategori) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Urun guncelle (Admin tam, Market Yoneticisi yalnizca kategori)' })
  @ApiOkResponse({ description: 'Guncellenmiş urun' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: { user: { id: string; role: UserRole } },
  ) {
    return this.productsService.update(id, dto, req.user);
  }

  // ---- Barkod Ekle (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post(':id/barcodes')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Urune barkod ekle (Admin)' })
  addBarcode(@Param('id') id: string, @Body() dto: AddBarcodeDto) {
    return this.productsService.addBarcode(id, dto);
  }
}
