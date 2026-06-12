// =====================================================
// Akıllı Sepet - Ana Uygulama Modulu
// Tum modulleri bir araya getirir ve global yapilandirmayi saglar
// =====================================================

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { MarketsModule } from './modules/markets/markets.module';
import { PricesModule } from './modules/prices/prices.module';
import { CartsModule } from './modules/carts/carts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CatalogsModule } from './modules/catalogs/catalogs.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DataSyncModule } from './modules/data-sync/data-sync.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { AdminModule } from './modules/admin/admin.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { PrismaModule } from './config/prisma.module';
import {
  appConfig, databaseConfig, jwtConfig, aiConfig, s3Config, firebaseConfig,
  dataSyncConfig, emailConfig, scraperConfig,
} from './config';
import { CommonModule } from './common/common.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // ---- Yapilandirma Modulu ----
    // Tum .env degiskenlerini yukleme ve dogrulama
    ConfigModule.forRoot({
      isGlobal: true, // Tum modullerde erisim saglar
      envFilePath: ['.env', '.env.local'],
      load: [
        appConfig, databaseConfig, jwtConfig, aiConfig, s3Config, firebaseConfig,
        dataSyncConfig, emailConfig, scraperConfig,
      ],
      expandVariables: true,
    }),

    // ---- Hiz Sinirlandirma (Rate Limiting) ----
    // DDoS ve brute-force saldirilarini onler
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: 60000,    // 60 saniye
            limit: 100,    // Maksimum 100 istek
          },
        ],
      }),
    }),

    // ---- BullMQ Kuyruk Sistemi ----
    // Asenkron isler icin: veri senkronizasyonu, bildirimler
    // Redis docker-compose ile her zaman hazir oldugundan dogrudan baglan
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),

    // ---- Cron Job Zamanlayicisi ----
    ScheduleModule.forRoot(),

    // ---- Veritabani ----
    PrismaModule,
    CommonModule,
    HealthModule,

    // ---- Ozellik Modulleri ----
    AuthModule,          // Kimlik dogrulama ve yetkilendirme
    UsersModule,         // Kullanici yonetimi
    ProductsModule,      // Urun CRUD ve barkod
    MarketsModule,       // Market ve sube yonetimi
    PricesModule,        // Fiyat yonetimi ve karsilastirma
    CartsModule,         // Sepet ve optimizasyon
    ReportsModule,       // Tarihi gecmis urun ihbarlari
    CatalogsModule,      // Aktuel katalog yonetimi
    AiModule,            // Yapay zeka servisleri
    NotificationsModule, // Bildirim sistemi
    DataSyncModule,      // Veri senkronizasyonu altyapisi
    ScraperModule,       // Gece fiyat scraper (sitemap + cheerio)
    AdminModule,         // Admin paneli ve raporlama
    StatisticsModule,    // Rol bazli istatistikler
    RewardsModule,       // Itibar odulleri ve market kuponlari
  ],
})
export class AppModule {}
