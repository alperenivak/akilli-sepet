// =====================================================
// Topluluk Ödülleri Controller
// =====================================================

import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { RewardsService } from './rewards.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AddRewardCodesDto } from './dto/add-reward-codes.dto';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @ApiOperation({ summary: 'Kullanıcının itibar ödülleri ve kupon durumu' })
  getMyRewards(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.getMyRewards(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('me/:rewardId/claim')
  @ApiOperation({ summary: 'Uygun ödül kuponunu talep et (idempotent)' })
  claimReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rewardId') rewardId: string,
  ) {
    return this.rewardsService.claimReward(user.id, rewardId);
  }

  // ---- Admin ----

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @Get('admin')
  @ApiOperation({ summary: 'Tüm ödüller ve stok durumu (admin)' })
  listAdmin() {
    return this.rewardsService.listAllAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @Post('admin')
  @ApiOperation({ summary: 'Yeni topluluk ödülü oluştur (admin)' })
  createAdmin(@Body() dto: CreateRewardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.createReward(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @Patch('admin/:rewardId')
  @ApiOperation({ summary: 'Ödül güncelle (admin)' })
  updateAdmin(
    @Param('rewardId') rewardId: string,
    @Body() dto: UpdateRewardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewardsService.updateReward(rewardId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @Post('admin/:rewardId/codes')
  @ApiOperation({ summary: 'Ödüle manuel kupon kodu ekle (admin)' })
  addCodesAdmin(
    @Param('rewardId') rewardId: string,
    @Body() dto: AddRewardCodesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    return this.rewardsService.addCodes(rewardId, dto.codes, expiresAt, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @Get('admin/:rewardId/claims')
  @ApiOperation({ summary: 'Ödül talep geçmişi (admin)' })
  listClaimsAdmin(
    @Param('rewardId') rewardId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewardsService.listClaims(rewardId, user);
  }

  // ---- Market Yöneticisi ----

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MARKET_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @Get('market')
  @ApiOperation({ summary: 'Market ödülleri (market yöneticisi)' })
  listMarket(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listMarketRewards(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MARKET_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @Post('market')
  @ApiOperation({ summary: 'Market için ödül oluştur' })
  createMarket(@Body() dto: CreateRewardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.createReward(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MARKET_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @Patch('market/:rewardId')
  @ApiOperation({ summary: 'Market ödülünü güncelle' })
  updateMarket(
    @Param('rewardId') rewardId: string,
    @Body() dto: UpdateRewardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewardsService.updateReward(rewardId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MARKET_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @Post('market/:rewardId/codes')
  @ApiOperation({ summary: 'Market ödülüne manuel kod ekle' })
  addCodesMarket(
    @Param('rewardId') rewardId: string,
    @Body() dto: AddRewardCodesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    return this.rewardsService.addCodes(rewardId, dto.codes, expiresAt, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MARKET_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @Get('market/:rewardId/claims')
  @ApiOperation({ summary: 'Market ödül talep geçmişi' })
  listClaimsMarket(
    @Param('rewardId') rewardId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewardsService.listClaims(rewardId, user);
  }
}
