import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody,
  ApiCreatedResponse, ApiNotFoundResponse, ApiForbiddenResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportFilterDto } from './dto/report-filter.dto';
import { PushToMarketDto } from './dto/push-to-market.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ---- Ihbar Olustur (Giris Gerekli) ----
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Son kullanma tarihi gecmis urun ihbar et' })
  @ApiCreatedResponse({ description: 'Ihbar olusturuldu' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(dto, user?.id);
  }

  // ---- Kendi Ihbarlarim ----
  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kendi ihbarlarimi listele' })
  getMyReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.reportsService.findMyReports(user.id, page, limit);
  }

  // ---- Istatistikler (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSPECTOR)
  @Get('stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ihbar istatistikleri (Admin/Denetci)' })
  getStats() {
    return this.reportsService.getStats();
  }

  // ---- Tum Ihbarlar (Admin/Denetci) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSPECTOR, UserRole.MARKET_MANAGER,
  )
  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ihbarlari listele (Admin/Denetci/Market yoneticisi)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filter: ReportFilterDto,
  ) {
    return this.reportsService.findAll(filter, user);
  }

  // ---- Ihbar Detayi ----
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ihbar detayi' })
  @ApiNotFoundResponse({ description: 'Ihbar bulunamadi' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.reportsService.findOne(id, user);
  }

  // ---- Ihbara Gorsel Yukle ----
  @UseGuards(JwtAuthGuard)
  @Post(':id/images')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ihbara fotograf yukle (MinIO/S3)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary', description: 'Fotograf dosyasi (max 5MB)' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Sadece gorsel dosyalari kabul edilir'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Gorsel dosyasi gerekli');
    return this.reportsService.addImage(id, file, user.id);
  }

  // ---- Durum Guncelle (Admin/Denetci) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSPECTOR, UserRole.MARKET_MANAGER,
  )
  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Ihbar durumunu guncelle',
    description: 'Durum makinesi: PENDING→UNDER_REVIEW→APPROVED|REJECTED, APPROVED→RESOLVED',
  })
  @ApiForbiddenResponse({ description: 'Gecersiz durum gecisi' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, user.id, dto, user);
  }

  // ---- Ihbari Markete Ilet (Denetci/Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INSPECTOR)
  @Patch(':id/push-to-market')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Ihbari ilgili markete ilet',
    description: 'Denetci inceleme sirasinda ihbari secilen markete push eder; market yoneticilerine bildirim gider.',
  })
  pushToMarket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PushToMarketDto,
  ) {
    return this.reportsService.pushToMarket(id, user.id, dto);
  }
}
