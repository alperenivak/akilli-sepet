// =====================================================
// Akıllı Sepet - Kullanici Controller'i
// Profil, FCM token ve admin kullanici endpoint'leri
// =====================================================

import {
  Controller, Get, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiOkResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client'; // Roles dekoratoru icin gerekli
import { UsersService } from './users.service';
import { ReputationService } from './reputation.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly reputationService: ReputationService,
  ) {}

  // ---- Kendi Profilim ----
  @Get('me')
  @ApiOperation({ summary: 'Giris yapan kullanicinin profilini getir' })
  @ApiOkResponse({ description: 'Kullanici profil bilgileri' })
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  // ---- Itibar profili (fiyat dogrulama + bildirim birlesik) ----
  @Get('me/reputation')
  @ApiOperation({ summary: 'Kullanici itibar ozeti, seviye ve aktivite gecmisi' })
  getMyReputation(@CurrentUser() user: AuthenticatedUser) {
    return this.reputationService.getProfile(user.id);
  }

  // ---- Profilimi Guncelle ----
  @Patch('me')
  @ApiOperation({ summary: 'Profil bilgilerini guncelle' })
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  // ---- FCM Token Guncelle ----
  @Patch('me/fcm-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Push bildirim tokenini guncelle' })
  updateFcmToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    return this.usersService.updateFcmToken(user.id, dto);
  }

  // ---- Kullanici Ozet Istatistikleri (Admin) ----
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Kullanici istatistikleri: toplam, aktif, rol dagilimi (Admin)' })
  @ApiOkResponse({ description: '{ total, active, inactive, roles }' })
  getStats() {
    return this.usersService.getStats();
  }

  // ---- Kullanicilari Listele (Admin) ----
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Tum kullanicilari listele (Admin)' })
  findAll(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  // ---- Kullanici Detayi (Admin) ----
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Kullanici detayi (Admin)' })
  @ApiNotFoundResponse({ description: 'Kullanici bulunamadi' })
  findOne(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  // ---- Kullanici Aktif/Pasif (Admin) ----
  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Kullanici aktif/pasif yap (Admin)' })
  toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.toggleActive(id, user.id);
  }

  // ---- Kullanici Rolu Degistir (Super Admin) ----
  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Kullanici rolunu degistir (Super Admin)' })
  changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.changeRole(id, dto.role, user.id);
  }

  // ---- Kullaniciya Ban Uygula (Admin) ----
  @Patch(':id/ban')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Kullaniciya gecici veya kalici ban uygula (Admin)' })
  banUser(
    @Param('id') id: string,
    @Body() dto: BanUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.banUser(id, user.id, dto.reason, {
      durationMinutes: dto.durationMinutes,
      isPermanent: dto.isPermanent,
    });
  }

  // ---- Ban Kaldir (Admin) ----
  @Patch(':id/unban')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Kullanici banini kaldir (Admin)' })
  unbanUser(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.unbanUser(id, user.id);
  }
}
