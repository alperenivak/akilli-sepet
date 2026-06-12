// =====================================================
// Akıllı Sepet - Kimlik Dogrulama Controller'i
// Kayit, giris, cikis ve token yenileme endpoint'leri
// =====================================================

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ---- E-posta OTP Gonder ----
  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'E-posta doğrulama kodu gönder',
    description: 'Kayıt (REGISTER) veya şifre sıfırlama (PASSWORD_RESET) için 6 haneli kod',
  })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.email, dto.purpose);
  }

  // ---- Kullanici Kaydi ----
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Yeni kullanici kaydı', description: 'E-posta OTP doğrulaması + bcrypt hash ile kayıt' })
  @ApiResponse({ status: 201, description: 'Kayit basarili, token donulur' })
  @ApiResponse({ status: 409, description: 'E-posta zaten kayitli' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // ---- Kullanici Girisi ----
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kullanici girisi', description: 'E-posta ve sifre ile giris yap' })
  @ApiResponse({ status: 200, description: 'Giris basarili, token donulur' })
  @ApiResponse({ status: 401, description: 'Gecersiz kimlik bilgileri' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // ---- Token Yenileme ----
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Access token yenileme', description: 'Refresh token ile yeni access token al' })
  @ApiResponse({ status: 200, description: 'Yeni access token donulur' })
  @ApiResponse({ status: 401, description: 'Gecersiz veya suresi dolmus refresh token' })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.userId, dto.refreshToken);
  }

  // ---- Cikis ----
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kullanici cikisi', description: 'Oturumu sonlandir ve refresh token temizle' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }

  // ---- Mevcut Kullanici Bilgisi ----
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mevcut kullanici bilgisi', description: 'Token ile giris yapan kullanicinin profilini getirir' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  // ---- Sifre Sifirlama (mobil, giris yapmadan) ----
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Şifre sıfırlama',
    description: 'E-postaya gönderilen OTP kodu ile şifre sıfırlama (mobil + admin panel)',
  })
  @ApiResponse({ status: 200, description: 'Şifre güncellendi' })
  @ApiResponse({ status: 400, description: 'Doğrulama başarısız' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ---- Sifre Degistirme ----
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Sifre degistirme' })
  @ApiResponse({ status: 200, description: 'Sifre basariyla degistirildi' })
  @ApiResponse({ status: 401, description: 'Mevcut sifre yanlis' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
