// =====================================================
// Akıllı Sepet - Bildirim Servisi
// Firebase FCM ile push bildirim yonetimi
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { NotificationType, UserRole } from '@prisma/client';
import type * as firebaseAdmin from 'firebase-admin';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseAdmin: typeof firebaseAdmin | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // OnModuleInit: Nest modulu hazir oldugunda Firebase'i baslat (constructor'da async cagri yerine)
  async onModuleInit(): Promise<void> {
    await this.initFirebase();
  }

  private async initFirebase(): Promise<void> {
    try {
      const projectId = this.configService.get<string>('firebase.projectId');
      const privateKey = this.configService.get<string>('firebase.privateKey');
      const clientEmail = this.configService.get<string>('firebase.clientEmail');

      if (projectId && privateKey && clientEmail) {
        const admin = require('firebase-admin');
        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
          });
        }
        this.firebaseAdmin = admin;
        this.logger.log('Firebase Admin SDK baslatildi');
      } else {
        this.logger.warn('Firebase yapilandirmasi eksik, bildirimler calismayacak');
      }
    } catch (error) {
      this.logger.error(`Firebase baslatma hatasi: ${(error as Error).message}`);
    }
  }

  // ---- Kullaniciya Bildirim Gonder ----
  async sendToUser(
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, string>,
  ) {
    // Bildirimi veritabanina kaydet
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type,
        data: data as any,
      },
    });

    // FCM token varsa push bildirim gonder
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user?.fcmToken && this.firebaseAdmin) {
      try {
        await this.firebaseAdmin.messaging().send({
          token: user.fcmToken,
          notification: { title, body },
          data: data || {},
          android: { priority: 'high' },
          apns: { payload: { aps: { badge: 1, sound: 'default' } } },
        });
        this.logger.debug(`Push bildirim gonderildi: ${userId}`);
      } catch (error) {
        this.logger.warn(`Push bildirim hatasi: ${(error as Error).message}`);
      }
    }

    return notification;
  }

  // ---- Kullanicinin Bildirimleri ----
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { items, total, unreadCount, page, limit };
  }

  // ---- Bildirimleri Okundu Olarak İşaretle ----
  async markAsRead(userId: string, notificationIds?: string[]) {
    const where = notificationIds
      ? { userId, id: { in: notificationIds } }
      : { userId, isRead: false };

    await this.prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });

    return { message: 'Bildirimler okundu olarak isaretlendi' };
  }

  // ---- Ihbar Durumu Degistiginde Bildirim Gonder ----
  async notifyReportStatusChange(
    reportId: string,
    newStatus: string,
    userNote?: string,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { userId: true, isAnonymous: true },
    });

    if (!report?.userId || report.isAnonymous) return;

    const statusMessages: Record<string, string> = {
      APPROVED: 'Ihbariniz onaylandi. Tesekkurler!',
      REJECTED: 'Ihbariniz incelendi ancak onaylanamadi.',
      UNDER_REVIEW: 'Ihbariniz incelemeye alindi.',
      RESOLVED: 'Ihbariniz cozumlendi.',
    };

    const base = statusMessages[newStatus] || 'Ihbar durumunuz guncellendi.';
    const message = userNote ? `${base} Not: ${userNote}` : base;

    await this.sendToUser(
      report.userId,
      'Ihbar Guncellendi',
      message,
      NotificationType.REPORT_STATUS,
      { reportId, status: newStatus, ...(userNote && { userNote }) },
    );
  }

  // ---- Ihbar Markete Iletildiginde Market Yoneticilerine Bildirim ----
  async notifyMarketManagersReportPush(
    marketId: string,
    reportId: string,
    marketName: string,
    description?: string | null,
    marketNote?: string,
  ) {
    const managers = await this.prisma.user.findMany({
      where: {
        role: UserRole.MARKET_MANAGER,
        managedMarketId: marketId,
        isActive: true,
      },
      select: { id: true },
    });

    const preview = marketNote
      ? (marketNote.length > 120 ? `${marketNote.slice(0, 120)}...` : marketNote)
      : description
        ? (description.length > 80 ? `${description.slice(0, 80)}...` : description)
        : 'Yeni bir ihbar marketinize iletildi.';

    await Promise.all(
      managers.map((m) =>
        this.sendToUser(
          m.id,
          `${marketName} — Yeni Ihbar`,
          preview,
          NotificationType.REPORT_STATUS,
          {
            reportId,
            marketId,
            action: 'MARKET_REPORT_PUSH',
            ...(marketNote && { marketNote }),
          },
        ),
      ),
    );
  }
}
