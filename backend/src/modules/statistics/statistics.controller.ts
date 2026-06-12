import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Sistem geneli istatistikler (Admin)' })
  getAdmin() {
    return this.statisticsService.getAdminStatistics();
  }

  @Get('inspector')
  @Roles(UserRole.INSPECTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ihbar inceleme istatistikleri (Denetci)' })
  getInspector(@CurrentUser() user: AuthenticatedUser) {
    return this.statisticsService.getInspectorStatistics(user);
  }

  @Get('market')
  @Roles(UserRole.MARKET_MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Market operasyon istatistikleri (Market Yoneticisi)' })
  getMarket(@CurrentUser() user: AuthenticatedUser) {
    return this.statisticsService.getMarketStatistics(user);
  }
}
