// =====================================================
// Akıllı Sepet - Sepet Controller'i
// Kimlik dogrulama olmadan da (session ile) calisir
// Login sonrasi oturum sepeti kullanici sepetiyle birlesir
// =====================================================

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Headers, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiHeader, ApiOkResponse,
} from '@nestjs/swagger';
import type { CartSummary, CartOptimizationResult } from './carts.service';
import { CartsService } from './carts.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('carts')
@ApiHeader({
  name: 'x-session-id',
  description: 'Giris yapilmamis kullanicilar icin oturum ID',
  required: false,
})
@Controller('carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  // ---- Sepeti Getir ----
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Sepeti getir (giris gerekli)' })
  @ApiOkResponse({ description: 'Kullanici sepeti: { id, userId, items, totalItems }' })
  getCart(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-session-id') sessionId: string,
  ): Promise<CartSummary> {
    return this.cartsService.getOrCreateCart(user?.id, sessionId);
  }

  // ---- Anonim Sepet (Session ile) ----
  @Public()
  @Get('session')
  @ApiOperation({ summary: 'Anonim sepet getir (x-session-id header gerekli)' })
  @ApiOkResponse({ description: 'Anonim oturum sepeti' })
  async getSessionCart(@Headers('x-session-id') sessionId: string): Promise<CartSummary> {
    // sessionId yoksa bos sepet donulur; service katmaninda olusturma yapilmaz
    if (!sessionId) {
      return { id: '', userId: null, sessionId: null, items: [], totalItems: 0, totalCost: 0, marketGroups: [] };
    }
    return this.cartsService.getOrCreateCart(undefined, sessionId);
  }

  // ---- Sepete Urun Ekle ----
  @UseGuards(JwtAuthGuard)
  @Post('items')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Sepete urun ekle' })
  @ApiOkResponse({ description: 'Guncellenmiş sepet' })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-session-id') sessionId: string,
    @Body() dto: AddCartItemDto,
  ): Promise<CartSummary> {
    return this.cartsService.addItem(dto, user?.id, sessionId);
  }

  // ---- Urun Adeti Guncelle ----
  @UseGuards(JwtAuthGuard)
  @Patch('items/:itemId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Sepetteki urun adedini guncelle (quantity=0 kaldirir)' })
  updateItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-session-id') sessionId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartSummary> {
    return this.cartsService.updateItem(itemId, dto, user?.id, sessionId);
  }

  // ---- Urun Kaldır ----
  @UseGuards(JwtAuthGuard)
  @Delete('items/:itemId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Sepetten urun kaldir' })
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-session-id') sessionId: string,
  ): Promise<CartSummary> {
    return this.cartsService.removeItem(itemId, user?.id, sessionId);
  }

  // ---- Sepeti Bosalt ----
  @UseGuards(JwtAuthGuard)
  @Delete('clear')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tum urunleri sepetten kaldir' })
  clearCart(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-session-id') sessionId: string,
  ) {
    return this.cartsService.clearCart(user?.id, sessionId);
  }

  // ---- Sepet Optimizasyonu ----
  @UseGuards(JwtAuthGuard)
  @Get('optimize')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Sepet icin en ucuz marketi hesapla',
    description: 'Marketleri toplam maliyete gore siralar, eksik urunleri gosterir',
  })
  @ApiOkResponse({ description: 'Sepet analizi: secilen market toplami, tek market alternatifleri, tasarruf onerileri' })
  async optimizeCart(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-session-id') sessionId: string,
  ): Promise<CartOptimizationResult> {
    return this.cartsService.optimizeCart(user?.id, sessionId);
  }

  // ---- Sepet Birlestir (Login sonrasi) ----
  @UseGuards(JwtAuthGuard)
  @Post('merge')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Anonim sepeti kullanici sepetiyle birlestir (login sonrasi)' })
  mergeCarts(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-session-id') sessionId: string,
  ): Promise<CartSummary> {
    // sessionId yoksa veya bossa sadece kullanici sepetini getir
    // Kontrol servise devredildi: mergeCarts icinde sessionId zorunlu
    return this.cartsService.mergeCarts(sessionId ?? '', user.id);
  }
}
