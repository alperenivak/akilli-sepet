// =====================================================
// Akıllı Sepet - MinIO / S3 Dosya Depolama Servisi
// Gorsel yukleme, silme ve URL olusturma islemlerini yonetir
// =====================================================

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private endpoint: string;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    const accessKey = this.configService.get<string>('s3.accessKey');
    const secretKey = this.configService.get<string>('s3.secretKey');
    this.endpoint = this.configService.get<string>('s3.endpoint', 'http://localhost:9000');
    this.bucketName = this.configService.get<string>('s3.bucketName', 'Akıllı Sepet');

    if (!accessKey || !secretKey) {
      this.logger.warn('S3/MinIO yapilandirmasi eksik, dosya yukleme devre disi');
      return;
    }

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>('s3.region', 'us-east-1'),
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true, // MinIO icin zorunlu
    });

    this.isConfigured = true;
  }

  async onModuleInit() {
    if (!this.isConfigured) return;
    await this.ensureBucketExists();
  }

  // ---- Bucket yoksa olustur ----
  private async ensureBucketExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`MinIO bucket hazir: ${this.bucketName}`);
    } catch {
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
        this.logger.log(`MinIO bucket olusturuldu: ${this.bucketName}`);
      } catch (createError) {
        this.logger.error(`Bucket olusturulamadi: ${(createError as Error).message}`);
      }
    }
  }

  // ---- Dosya yukle ----
  // folder: 'reports', 'products', 'catalogs' gibi alt klasor
  // Returns: public URL
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'uploads',
  ): Promise<{ url: string; key: string; size: number }> {
    if (!this.isConfigured) {
      throw new Error('Dosya depolama servisi yapilandirilmamis');
    }

    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const key = `${folder}/${randomUUID()}${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    // MinIO public URL
    const url = `${this.endpoint}/${this.bucketName}/${key}`;

    this.logger.log(`Dosya yuklendi: ${key} (${buffer.length} byte)`);
    return { url, key, size: buffer.length };
  }

  // ---- Dosya sil ----
  async deleteFile(key: string): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
      this.logger.log(`Dosya silindi: ${key}`);
    } catch (error) {
      this.logger.warn(`Dosya silinemedi (${key}): ${(error as Error).message}`);
    }
  }

  get configured(): boolean {
    return this.isConfigured;
  }
}
