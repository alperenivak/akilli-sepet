import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth('JWT-auth')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard istatistikleri' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('data-quality')
  @ApiOperation({ summary: 'Urun veri kalitesi ozeti (gorsel, fiyat, kategori)' })
  getDataQuality() {
    return this.adminService.getDataQuality();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Sistem audit log kayitlari' })
  getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAuditLogs(page, limit);
  }

  @Get('scraper-logs')
  @ApiOperation({ summary: 'Veri sync loglari (geriye uyumlu alias)' })
  getScraperLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getDataSyncLogs(page, limit);
  }

  @Get('data-sync-logs')
  @ApiOperation({ summary: 'Veri senkronizasyon loglari' })
  getDataSyncLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getDataSyncLogs(page, limit);
  }
}
