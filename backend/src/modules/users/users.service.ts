// =====================================================
// Akıllı Sepet - Kullanici Servisi
// Profil yonetimi, FCM token, admin kullanici yonetimi
// =====================================================

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { UserRole } from '@prisma/client';
import { getActiveBan } from '../../common/utils/ban.util';

// Hassas alanlari icerik disinda birak
const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  surname: true,
  phone: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  bannedUntil: true,
  banReason: true,
  isPermanentBan: true,
  createdAt: true,
  updatedAt: true,
  managedMarket: { select: { id: true, name: true, brandColor: true, logoUrl: true, website: true } },
  reputationScore: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Profil Goruntule ----
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SAFE_SELECT,
    });

    if (!user) throw new NotFoundException('Kullanici bulunamadi');
    return user;
  }

  // ---- Profil Guncelle ----
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId); // Kullanici varligini dogrula

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: USER_SAFE_SELECT,
    });
  }

  // ---- FCM Token Guncelle (Push Bildirim) ----
  async updateFcmToken(userId: string, dto: UpdateFcmTokenDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken: dto.fcmToken },
      select: { id: true, fcmToken: true },
    });
  }

  // ---- Kullanici Ozet Istatistikleri (Admin) ----
  async getStats() {
    const [total, active, byRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    ]);

    const roles = byRole.reduce(
      (acc, row) => { acc[row.role] = row._count._all; return acc; },
      {} as Record<string, number>,
    );

    return { total, active, inactive: total - active, roles };
  }

  // ---- Kullanicilari Listele (Admin) ----
  async findAll(filter: UserFilterDto) {
    const { page = 1, limit = 20, search, role, isActive } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { surname: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: USER_SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
    };
  }

  // ---- Kullanici Aktif/Pasif Toglele (Admin) ----
  async toggleActive(targetUserId: string, requesterId: string) {
    // Admin kendi hesabini pasife alamaz
    if (targetUserId === requesterId) {
      throw new ForbiddenException('Kendi hesabinizi pasife alamazsiniz');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, isActive: true, role: true },
    });

    if (!target) throw new NotFoundException('Kullanici bulunamadi');

    // Super admin hesabi pasife alinamaz
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin hesabi pasife alinamaz');
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: !target.isActive },
      select: USER_SAFE_SELECT,
    });
  }

  // ---- Kullanici Rolu Degistir (Super Admin) ----
  async changeRole(targetUserId: string, newRole: UserRole, requesterId: string) {
    if (targetUserId === requesterId) {
      throw new ForbiddenException('Kendi rolunuzu degistiremezsiniz');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!target) throw new NotFoundException('Kullanici bulunamadi');

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: USER_SAFE_SELECT,
    });
  }

  // ---- Kullaniciya Gecici veya Kalici Ban Uygula (Admin) ----
  async banUser(
    targetUserId: string,
    requesterId: string,
    reason: string,
    options: { durationMinutes?: number; isPermanent?: boolean },
  ) {
    if (targetUserId === requesterId) {
      throw new ForbiddenException('Kendinizi ban edemezsiniz');
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      throw new BadRequestException('Ban sebebi en az 3 karakter olmalidir');
    }

    const isPermanent = options.isPermanent === true;
    const durationMinutes = options.durationMinutes;

    if (!isPermanent && (!durationMinutes || durationMinutes < 1 || durationMinutes > 43200)) {
      throw new BadRequestException('Ban suresi 1 dk ile 30 gun arasinda olmalidir');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, name: true, fcmToken: true },
    });

    if (!target) throw new NotFoundException('Kullanici bulunamadi');
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin ban edilemez');
    }

    const bannedUntil = isPermanent
      ? null
      : new Date(Date.now() + durationMinutes! * 60 * 1000);

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        bannedUntil,
        banReason: trimmedReason,
        isPermanentBan: isPermanent,
      },
      select: USER_SAFE_SELECT,
    });

    // Bildirim kaydı (Notification tablosuna)
    try {
      await this.prisma.notification.create({
        data: {
          userId: targetUserId,
          title: isPermanent
            ? 'Hesabiniz Kalici Olarak Kisitlandi'
            : 'Hesabiniz Gecici Olarak Kisitlandi',
          body: isPermanent
            ? `Sebep: ${trimmedReason}. Hesabiniz kalici olarak kisitlandi.`
            : `Sebep: ${trimmedReason}. Kisitlama ${bannedUntil!.toLocaleString('tr-TR')} tarihinde sona erecek.`,
          type: 'SYSTEM' as any,
          data: {
            type: 'USER_BANNED',
            isPermanentBan: isPermanent,
            bannedUntil: bannedUntil?.toISOString() ?? null,
            banReason: trimmedReason,
          } as any,
        },
      });
    } catch { /* bildirim tablosu yoksa sessizce devam et */ }

    return updated;
  }

  // ---- Ban Kaldir (Admin) ----
  async unbanUser(targetUserId: string, requesterId: string) {
    if (targetUserId === requesterId) {
      throw new ForbiddenException('Gecersiz islem');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, bannedUntil: true },
    });

    if (!target) throw new NotFoundException('Kullanici bulunamadi');

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { bannedUntil: null, banReason: null, isPermanentBan: false },
      select: USER_SAFE_SELECT,
    });
  }

  // ---- Ban Durumunu Kontrol Et ----
  async getBanStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bannedUntil: true, banReason: true, isPermanentBan: true },
    });
    if (!user) return { isBanned: false as const };

    const activeBan = getActiveBan(user);
    if (activeBan.isBanned) {
      return {
        isBanned: true as const,
        isPermanentBan: activeBan.isPermanent,
        bannedUntil: activeBan.bannedUntil,
        banReason: activeBan.banReason,
      };
    }

    // Gecici ban suresi dolmussa temizle
    if (user.bannedUntil && user.bannedUntil <= new Date()) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { bannedUntil: null, banReason: null, isPermanentBan: false },
      });
    }

    return { isBanned: false as const };
  }
}
