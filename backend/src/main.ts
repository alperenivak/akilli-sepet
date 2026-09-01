// =====================================================
// Akıllı Sepet Backend - Ana Giris Noktasi
// NestJS uygulamasini baslatir, global ayarlar yapilir
// =====================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // NestJS uygulamasini olustur
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  // Railway ve diger PaaS ortamlari PORT env verir; ConfigService yerine dogrudan oku
  const port = parseInt(process.env.PORT ?? '', 10) || 3000;
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // ---- Guvenlik Middleware'leri ----
  // HTTP guvenlik basliklarini ayarla
  app.use(helmet());
  // Yanit gzip sikistirma
  app.use(compression());
  // Cookie islemleri icin
  app.use(cookieParser());

  // ---- CORS Ayarlari ----
  const isDev = nodeEnv !== 'production';
  const corsOriginsRaw = configService.get<string>('CORS_ORIGINS', '');
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const productionOrigins = [
    ...corsOrigins,
    configService.get<string>('ADMIN_PANEL_URL', ''),
    configService.get<string>('FRONTEND_URL', ''),
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);

  app.enableCors({
    origin: isDev
      ? true
      : (origin, callback) => {
          if (!origin || productionOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked: ${origin}`), false);
          }
        },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-session-id'],
  });

  // ---- Global API Prefix ----
  // Mobil ve admin panel /api prefix'i kullanir
  app.setGlobalPrefix('api');

  // ---- Global Validation Pipe ----
  // Tum isteklerin DTO dogrulamasini otomatik yapar
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Bilinmeyen alanlari atar
      forbidNonWhitelisted: true, // Bilinmeyen alan gelirse hata verir
      transform: true,         // Tipleri otomatik donusturur
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ---- Global Filtreler ----
  app.useGlobalFilters(new HttpExceptionFilter());

  // ---- Global Interceptor'lar ----
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ---- Swagger API Dokumantasyonu (Sadece Development) ----
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Akıllı Sepet API')
      .setDescription(
        'Supermarketlerde Mobil Fiyat Karsilastirma, Sepet Optimizasyonu ve Tarihi Gecmis Urun Ihbar Sistemi API Dokumantasyonu',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Access Token giriniz',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Kimlik Dogrulama')
      .addTag('products', 'Urun Yonetimi')
      .addTag('markets', 'Market Yonetimi')
      .addTag('prices', 'Fiyat Yonetimi')
      .addTag('carts', 'Sepet Yonetimi')
      .addTag('reports', 'Ihbar Yonetimi')
      .addTag('catalogs', 'Katalog Yonetimi')
      .addTag('ai', 'Yapay Zeka Servisleri')
      .addTag('admin', 'Admin Paneli')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // Yeniden yuklemede token'i koru
      },
    });

    logger.log(`Swagger dokumantasyonu: http://localhost:${port}/api/docs`);
  }

  // ---- Uygulamayi Baslat ----
  // 0.0.0.0: telefon/emulator LAN uzerinden erisebilsin
  await app.listen(port, '0.0.0.0');
  
  logger.log(`PORT env: ${process.env.PORT ?? '(unset)'} -> dinlenen port: ${port}`);
  logger.log(`Akıllı Sepet API ${port} portunda calisiyor`);
  logger.log(`Ortam: ${nodeEnv}`);
}

bootstrap().catch((error) => {
  console.error('Uygulama baslatilamadi:', error);
  process.exit(1);
});
