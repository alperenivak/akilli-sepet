// =====================================================
// Akıllı Sepet - Prisma Servisi
// Veritabani baglantisi ve yasamdongüsü yonetimi
// =====================================================

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Veritabani baglantisi basarili');
    } catch (error) {
      this.logger.error('Veritabani baglantisi basarisiz:', error);
      // Production: HTTP sunucusu ayaga kalksin, /health/ready degraded donsun
      if (process.env.NODE_ENV !== 'production') {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    // Uygulama kapanirken baglantıyi kapat
    await this.$disconnect();
    this.logger.log('Veritabani baglantisi kapatildi');
  }

  // Veritabanini temizleme - sadece test ortaminda kullanilir
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase sadece test ortaminda calistirilamaz');
    }

    // Tum tablolari sirali bicimde temizle (foreign key sirasi onemli)
    const tablesToClean = [
      'audit_logs',
      'ai_recommendations',
      'notifications',
      'scraper_logs',
      'data_sync_logs',
      'email_otps',
      'price_feedbacks',
      'catalog_pages',
      'catalogs',
      'report_images',
      'reports',
      'cart_items',
      'carts',
      'price_history',
      'prices',
      'barcodes',
      'products',
      'market_branches',
      'markets',
      'categories',
      'users',
    ];

    for (const table of tablesToClean) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    }
  }
}
