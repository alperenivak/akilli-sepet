// =====================================================
// Scraper Controller — admin manuel tetikleme
// =====================================================

import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PriceScraperService } from './price-scraper.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraper: PriceScraperService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Scraper durumu ve yapilandirilmis marketler' })
  getStatus() {
    return this.scraper.getStatus();
  }

  @Post('run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tum scraperEnabled marketler icin manuel calistir' })
  runAll() {
    return this.scraper.runAllEnabledMarkets();
  }

  @Post('run/:marketId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tek market icin scraper calistir' })
  runMarket(@Param('marketId') marketId: string) {
    return this.scraper.runForMarket(marketId);
  }
}
