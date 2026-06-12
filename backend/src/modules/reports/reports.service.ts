// =====================================================
// Akıllı Sepet - Ihbar Servisi
// Son kullanma tarihi gecmis urun bildirimi yonetimi
//
// DURUM MAKİNESİ:
//   PENDING -> UNDER_REVIEW -> APPROVED | REJECTED
//   APPROVED -> RESOLVED
// =====================================================

import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { ReportStatus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportFilterDto } from './dto/report-filter.dto';
import { PushToMarketDto } from './dto/push-to-market.dto';

// Gecerli durum gecisleri
const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.PENDING]: [ReportStatus.UNDER_REVIEW, ReportStatus.REJECTED],
  [ReportStatus.UNDER_REVIEW]: [ReportStatus.APPROVED, ReportStatus.REJECTED],
  [ReportStatus.APPROVED]: [ReportStatus.RESOLVED],
  [ReportStatus.REJECTED]: [],
  [ReportStatus.RESOLVED]: [],
};

/** Rol bazli not gorunurlugu — her taraf yalnizca kendi kanalindaki notu gorur */
type ReportNoteFields = { userNote?: string | null; marketNote?: string | null };

function stripNotesForRole<T extends ReportNoteFields>(
  report: T,
  role?: UserRole,
  options?: { isOwner?: boolean },
): T {
  if (options?.isOwner || role === UserRole.USER) {
    const { marketNote: _m, ...rest } = report;
    return rest as T;
  }
  if (role === UserRole.MARKET_MANAGER) {
    const { userNote: _u, ...rest } = report;
    return rest as T;
  }
  return report;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- Ihbar Olustur ----
  async create(dto: CreateReportDto, userId?: string) {
    const { imageUrls, marketNameOther, ...reportData } = dto;

    return this.prisma.report.create({
      data: {
        ...reportData,
        marketNameOther: marketNameOther?.trim() || undefined,
        userId: dto.isAnonymous ? null : userId,
        status: ReportStatus.PENDING,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        ...(imageUrls?.length && {
          images: {
            create: imageUrls.map((url) => ({
              url,
              fileName: url.split('/').pop() || 'image',
              fileSize: 0,
            })),
          },
        }),
      },
      include: {
        product: { select: { id: true, name: true } },
        market: { select: { id: true, name: true, logoUrl: true } },
        branch: { select: { id: true, name: true, address: true } },
        images: true,
      },
    });
  }

  // ---- Kendi Ihbarlarim ----
  async findMyReports(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true } },
          market: { select: { id: true, name: true, logoUrl: true } },
          images: { take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where: { userId } }),
    ]);

    return {
      items: items.map((r) => stripNotesForRole(r, UserRole.USER, { isOwner: true })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---- Tum Ihbarlar (Admin/Denetci) ----
  async findAll(filter: ReportFilterDto, requester?: AuthenticatedUser) {
    const { page = 1, limit = 20, status, marketId, city, pushedToMarket } = filter;
    const skip = (page - 1) * limit;

    let scopedMarketId = marketId;
    let scopedPushed = pushedToMarket;

    if (requester?.role === UserRole.MARKET_MANAGER) {
      const mgr = await this.prisma.user.findUnique({
        where: { id: requester.id },
        select: { managedMarketId: true },
      });
      if (!mgr?.managedMarketId) {
        throw new ForbiddenException('Market yoneticisi hesabiniza market atanmamis');
      }
      scopedMarketId = mgr.managedMarketId;
      scopedPushed = true;
    }

    const where = {
      ...(status && { status }),
      ...(scopedMarketId && { marketId: scopedMarketId }),
      ...(city && { city }),
      ...(scopedPushed === true && { pushedToMarketAt: { not: null } }),
      ...(scopedPushed === false && { pushedToMarketAt: null }),
    };

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true } },
          market: { select: { id: true, name: true, logoUrl: true } },
          branch: { select: { id: true, name: true } },
          pushedBy: { select: { id: true, name: true, surname: true } },
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: items.map((r) => stripNotesForRole(r, requester?.role)),
      total, page, limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
    };
  }

  // ---- Ihbar Detayi ----
  async findOne(id: string, requester?: AuthenticatedUser) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        product: true,
        market: true,
        branch: { select: { id: true, name: true, address: true, city: true } },
        images: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
        pushedBy: { select: { id: true, name: true, surname: true } },
      },
    });

    if (!report) throw new NotFoundException('Ihbar bulunamadi');

    if (requester?.role === UserRole.MARKET_MANAGER) {
      const mgr = await this.prisma.user.findUnique({
        where: { id: requester.id },
        select: { managedMarketId: true },
      });
      if (
        !report.pushedToMarketAt ||
        report.marketId !== mgr?.managedMarketId
      ) {
        throw new ForbiddenException('Bu ihbara erisim yetkiniz yok');
      }
    }

    const isOwner = !!requester?.id && report.userId === requester.id;
    return stripNotesForRole(report, requester?.role, { isOwner });
  }

  // ---- Denetci: Ihbari Markete Ilet (Push) ----
  async pushToMarket(reportId: string, inspectorId: string, dto: PushToMarketDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true, status: true, description: true, marketNameOther: true,
      },
    });
    if (!report) throw new NotFoundException('Ihbar bulunamadi');

    const market = await this.prisma.market.findUnique({
      where: { id: dto.marketId },
      select: { id: true, name: true, isActive: true },
    });
    if (!market || !market.isActive) {
      throw new BadRequestException('Gecerli bir market seciniz');
    }

    if (dto.branchId) {
      const branch = await this.prisma.marketBranch.findFirst({
        where: { id: dto.branchId, marketId: dto.marketId, isActive: true },
      });
      if (!branch) throw new BadRequestException('Secilen sube bu markete ait degil');
    }

    const newStatus =
      report.status === ReportStatus.PENDING ? ReportStatus.UNDER_REVIEW : report.status;

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        marketId: dto.marketId,
        branchId: dto.branchId ?? null,
        pushedToMarketAt: new Date(),
        pushedById: inspectorId,
        status: newStatus,
        reviewedById: inspectorId,
        reviewedAt: new Date(),
        ...(dto.marketNote?.trim() && { marketNote: dto.marketNote.trim() }),
      },
      include: {
        market: { select: { id: true, name: true, logoUrl: true } },
        branch: { select: { id: true, name: true, address: true } },
        pushedBy: { select: { id: true, name: true, surname: true } },
      },
    });

    await this.notifications.notifyMarketManagersReportPush(
      dto.marketId,
      reportId,
      market.name,
      report.description,
      dto.marketNote?.trim(),
    );

    return updated;
  }

  // ---- Ihbar Durumu Guncelle (Durum Makinesi) ----
  async updateStatus(
    reportId: string,
    reviewerId: string,
    dto: UpdateReportStatusDto,
    requester?: AuthenticatedUser,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true, status: true, userId: true, marketId: true, pushedToMarketAt: true,
      },
    });
    if (!report) throw new NotFoundException('Ihbar bulunamadi');

    if (requester?.role === UserRole.MARKET_MANAGER) {
      const mgr = await this.prisma.user.findUnique({
        where: { id: requester.id },
        select: { managedMarketId: true },
      });
      if (
        !report.pushedToMarketAt ||
        report.marketId !== mgr?.managedMarketId
      ) {
        throw new ForbiddenException('Bu ihbari guncelleme yetkiniz yok');
      }
    }

    // Gecerli gecis mi?
    const allowed = VALID_TRANSITIONS[report.status];
    if (!allowed.includes(dto.status)) {
      throw new ForbiddenException(
        `"${report.status}" durumundan "${dto.status}" durumuna gecis yapilamaz. ` +
        `Gecerli gecisler: ${allowed.join(', ') || 'Yok'}`,
      );
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        ...(dto.userNote !== undefined && {
          userNote: dto.userNote?.trim() || null,
        }),
      },
    });

    try {
      await this.notifications.notifyReportStatusChange(
        reportId,
        dto.status,
        dto.userNote?.trim(),
      );
    } catch { /* bildirim hatasi ihbari engellemez */ }

    return stripNotesForRole(updated, requester?.role);
  }

  // ---- Ihbara Gorsel Yukle ----
  async addImage(
    reportId: string,
    file: Express.Multer.File,
    _userId?: string,
  ): Promise<{ url: string; thumbnailUrl: string | null }> {
    // Ihbar var mi ve kullanici yetkili mi?
    const report = await this.prisma.report.findFirst({
      where: { id: reportId },
      select: { id: true, userId: true },
    });
    if (!report) throw new NotFoundException('Ihbar bulunamadi');

    // Storage'a yukle
    const { url, size } = await this.storage.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      'reports',
    );

    // DB'ye kaydet
    const image = await this.prisma.reportImage.create({
      data: {
        reportId,
        url,
        fileName: file.originalname,
        fileSize: size,
        thumbnailUrl: null,
      },
    });

    return { url: image.url, thumbnailUrl: image.thumbnailUrl };
  }

  // ---- Istatistikler (Admin Dashboard) ----
  async getStats() {
    const [total, pending, underReview, approved, rejected, resolved] =
      await Promise.all([
        this.prisma.report.count(),
        this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
        this.prisma.report.count({ where: { status: ReportStatus.UNDER_REVIEW } }),
        this.prisma.report.count({ where: { status: ReportStatus.APPROVED } }),
        this.prisma.report.count({ where: { status: ReportStatus.REJECTED } }),
        this.prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
      ]);

    const topMarkets = await this.prisma.report.groupBy({
      by: ['marketId'],
      where: { marketId: { not: null } },
      _count: { marketId: true },
      orderBy: { _count: { marketId: 'desc' } },
      take: 5,
    });

    return {
      total, pending, underReview, approved, rejected, resolved,
      topMarkets,
    };
  }
}
