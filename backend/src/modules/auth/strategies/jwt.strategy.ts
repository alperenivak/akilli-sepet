// =====================================================
// Akıllı Sepet - JWT Strateji
// Passport JWT token dogrulama stratejisi
// =====================================================

import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { buildUserBannedException, getActiveBan } from '../../../common/utils/ban.util';

// JWT payload'dan cikartilan kullanici bilgisi
export interface JwtPayload {
  sub: string;    // Kullanici ID
  email: string;
  role: UserRole;
}

// validate metodunun donus tipi (AuthenticatedUser ile uyumlu)
export interface ValidatedUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  name: string | null;
  surname: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      // Bearer token olarak Authorization baslıgindan cıkar
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    // Token gecerliyse veritabanından kullaniciyi al
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        name: true,
        surname: true,
        bannedUntil: true,
        banReason: true,
        isPermanentBan: true,
      },
    });

    // Kullanici yoksa veya devre disi ise reddet
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Gecersiz veya suresi dolmus token');
    }

    // Ban kontrolu (gecici veya kalici)
    const activeBan = getActiveBan(user);
    if (activeBan.isBanned) {
      throw new HttpException(
        buildUserBannedException(activeBan),
        HttpStatus.FORBIDDEN,
      );
    }

    // Gecici ban suresi dolmussa DB'yi temizle (lazy cleanup)
    if (!user.isPermanentBan && user.bannedUntil && user.bannedUntil <= new Date()) {
      void this.prisma.user.update({
        where: { id: user.id },
        data: { bannedUntil: null, banReason: null, isPermanentBan: false },
      });
    }

    // Request nesnesine kullanici bilgisini ekle
    return user;
  }
}
