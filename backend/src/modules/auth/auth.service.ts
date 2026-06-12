// =====================================================
// Akıllı Sepet - Kimlik Dogrulama Servisi
// Kayit, giris, token yenileme ve sifre islemleri
// =====================================================

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { getActiveBan } from '../../common/utils/ban.util';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OtpService } from './otp.service';

// Sifre hashleme icin salt round sayisi
const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
  ) {}

  // ---- Kullanici Kaydi ----
  async register(registerDto: RegisterDto) {
    const { email, password, name, surname, phone, verificationCode } = registerDto;
    const normalizedEmail = email.trim().toLowerCase();

    await this.otpService.verifyAndConsume(normalizedEmail, 'REGISTER', verificationCode);

    // E-posta adresinin daha once kullanilip kullanilmadigini kontrol et
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Bu e-posta adresi zaten kayitli');
    }

    // Sifreyi hash'le - bcrypt ile guvenli saklama (duz metin ASLA saklanmaz)
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Kullaniciyi veritabanina kaydet
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name,
        surname,
        phone,
        emailVerified: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        role: true,
        createdAt: true,
      },
    });

    this.logger.log(`Yeni kullanici kaydi: ${user.email}`);

    // Token uret ve don
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Refresh token'i hashleyerek veritabanina kaydet
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user,
      ...tokens,
    };
  }

  // ---- Kullanici Girisi ----
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const normalizedEmail = email.trim().toLowerCase();

    // Kullaniciyi e-postaya gore bul (market yoneticisi ise marketi de getir)
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        managedMarket: {
          select: { id: true, name: true, logoUrl: true, brandColor: true, slug: true },
        },
      },
    });

    // Kullanici yoksa veya sifre yanlis ise genel hata mesaji goster
    // (Guvenlik: hangi bilginin yanlis oldugunu belirtme)
    if (!user || !user.isActive) {
      throw new UnauthorizedException('E-posta veya sifre hatali');
    }

    // Sifre dogru mu kontrol et
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('E-posta veya sifre hatali');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'E-posta adresiniz doğrulanmamış. Kayıt veya şifre sıfırlama ile doğrulama kodu alın.',
      );
    }

    // Token uret
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Refresh token'i guncelle
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Kullanici girisi: ${user.email}`);

    const activeBan = getActiveBan({
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      isPermanentBan: user.isPermanentBan,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.role,
        avatarUrl: user.avatarUrl,
        managedMarket: user.managedMarket ?? null,
        bannedUntil: activeBan.isBanned ? (activeBan.bannedUntil?.toISOString() ?? null) : null,
        banReason: activeBan.isBanned ? activeBan.banReason : null,
        isPermanentBan: activeBan.isBanned ? activeBan.isPermanent : false,
      },
      ...tokens,
    };
  }

  // ---- Token Yenileme ----
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Erisim reddedildi');
    }

    // Refresh token eslesiyor mu kontrol et
    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Gecersiz refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // ---- Cikis ----
  async logout(userId: string) {
    // Refresh token'i temizle
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Cikis basarili' };
  }

  // ---- Sifre Sifirlama (e-posta OTP ile) ----
  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new BadRequestException('Bilgiler doğrulanamadı veya hesap bulunamadı.');
    }

    const activeBan = getActiveBan({
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      isPermanentBan: user.isPermanentBan,
    });
    if (activeBan.isBanned) {
      throw new BadRequestException('Hesabınız askıya alınmış. Destek ile iletişime geçin.');
    }

    await this.otpService.verifyAndConsume(email, 'PASSWORD_RESET', dto.verificationCode);

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null,
        emailVerified: true,
      },
    });

    this.logger.log(`Sifre sifirlandi (OTP): ${user.email}`);

    return { message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' };
  }

  // ---- OTP Kodu Gonder ----
  sendOtp(email: string, purpose: 'REGISTER' | 'PASSWORD_RESET') {
    return this.otpService.sendOtp(email, purpose);
  }

  // ---- Sifre Degistirme ----
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Kullanici bulunamadi');
    }

    // Mevcut sifre dogru mu?
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Mevcut sifre hatali');
    }

    // Yeni sifreyi hash'le ve kaydet
    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Sifre basariyla degistirildi' };
  }

  // ---- Yardimci: Token Olusturma ----
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn', '7d') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '30d') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 gun (saniye cinsinden)
    };
  }

  // ---- Yardimci: Refresh Token Kaydetme ----
  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }
}
