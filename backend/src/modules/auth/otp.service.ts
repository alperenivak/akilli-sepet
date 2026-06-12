// =====================================================
// E-posta OTP Servisi — kod uretimi, hash, dogrulama
// =====================================================

import {
  Injectable, BadRequestException, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/prisma.service';
import { EmailService } from '../../common/services/email.service';
import { UserRole } from '@prisma/client';

export type OtpPurpose = 'REGISTER' | 'PASSWORD_RESET';

const OTP_SALT_ROUNDS = 10;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async sendOtp(email: string, purpose: OtpPurpose): Promise<{ message: string; expiresInMinutes: number }> {
    const normalized = email.trim().toLowerCase();
    const expiresMin = this.config.get<number>('email.otpExpiresMinutes', 10);
    const cooldownSec = this.config.get<number>('email.otpResendCooldownSeconds', 60);

    if (purpose === 'REGISTER') {
      const exists = await this.prisma.user.findUnique({ where: { email: normalized } });
      if (exists) throw new BadRequestException('Bu e-posta adresi zaten kayıtlı');
    } else {
      const user = await this.prisma.user.findUnique({ where: { email: normalized } });
      if (!user || !user.isActive) {
        // Guvenlik: kullanici yoksa da ayni mesaj
        return {
          message: 'E-posta kayıtlıysa doğrulama kodu gönderildi.',
          expiresInMinutes: expiresMin,
        };
      }
    }

    const recent = await this.prisma.emailOtp.findFirst({
      where: {
        email: normalized,
        purpose,
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - cooldownSec * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new HttpException(
        `Yeni kod göndermek için ${cooldownSec} saniye bekleyin.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Eski kullanilmamis kodlari iptal et
    await this.prisma.emailOtp.updateMany({
      where: { email: normalized, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, OTP_SALT_ROUNDS);

    await this.prisma.emailOtp.create({
      data: {
        email: normalized,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + expiresMin * 60 * 1000),
      },
    });

    if (purpose === 'REGISTER' || (await this.prisma.user.findUnique({ where: { email: normalized } }))) {
      try {
        await this.email.sendOtpCode(
          normalized,
          code,
          purpose === 'REGISTER' ? 'register' : 'password_reset',
        );
      } catch (err) {
        this.logger.error(`E-posta gönderilemedi: ${(err as Error).message}`);
        throw new BadRequestException('E-posta gönderilemedi. SMTP/API ayarlarını kontrol edin.');
      }
    }

    return {
      message: 'Doğrulama kodu e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin.',
      expiresInMinutes: expiresMin,
    };
  }

  async verifyAndConsume(email: string, purpose: OtpPurpose, code: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!/^\d{6}$/.test(trimmedCode)) {
      throw new BadRequestException('Geçerli 6 haneli doğrulama kodu giriniz');
    }

    const otp = await this.prisma.emailOtp.findFirst({
      where: {
        email: normalized,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('Doğrulama kodu geçersiz veya süresi dolmuş');
    }

    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      throw new BadRequestException('Çok fazla hatalı deneme. Yeni kod isteyin.');
    }

    const valid = await bcrypt.compare(trimmedCode, otp.codeHash);
    if (!valid) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Doğrulama kodu hatalı');
    }

    await this.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });
  }
}
