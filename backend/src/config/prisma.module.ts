// =====================================================
// Akıllı Sepet - Prisma Veritabani Modulu
// Prisma Client'i NestJS'e global olarak entegre eder
// =====================================================

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global decorator ile tum modullerde inject edilebilir
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
