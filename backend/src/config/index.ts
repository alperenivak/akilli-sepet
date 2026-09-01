// =====================================================
// Akıllı Sepet - Yapilandirma Dosyalari
// Tum ortam degiskenlerini tip guvenligi ile yonetir
// =====================================================

import { registerAs } from '@nestjs/config';

// ---- Uygulama Yapilandirmasi ----
export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:3001',
}));

// ---- Veritabani Yapilandirmasi ----
export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

// ---- JWT Yapilandirmasi ----
export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'gizli_anahtar_degistirilmeli',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_gizli_anahtar',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
}));

// ---- AI Servis Yapilandirmasi ----
export const aiConfig = registerAs('ai', () => ({
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
  preferredProvider: process.env.AI_PREFERRED_PROVIDER || 'gemini',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
}));

// ---- S3 Depolama Yapilandirmasi ----
export const s3Config = registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  bucketName: process.env.S3_BUCKET_NAME || 'Akıllı Sepet',
  region: process.env.S3_REGION || 'us-east-1',
}));

// ---- Firebase Yapilandirmasi ----
export const firebaseConfig = registerAs('firebase', () => ({
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
}));

// ---- Redis Yapilandirmasi ----
export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
}));

/** BullModule.forRootAsync icin redis secenegi */
export function resolveBullRedis(config: {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
}): string | { host: string; port: number; password?: string } {
  const url = config.url?.trim();
  if (url) return url;
  return {
    host: config.host || 'localhost',
    port: config.port ?? 6379,
    password: config.password || undefined,
  };
}

export { dataSyncConfig } from './data-sync.config';
export { emailConfig } from './email.config';
export { scraperConfig } from './scraper.config';
