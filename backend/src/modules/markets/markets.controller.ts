import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { MarketsService } from './markets.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { NearbyBranchesDto } from './dto/nearby-branches.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  // ---- Marketler (Herkese Acik) ----
  @Public()
  @Get()
  @ApiOperation({ summary: 'Aktif marketleri listele' })
  @ApiOkResponse({ description: 'Aktif market listesi' })
  findAll() {
    return this.marketsService.findAll();
  }

  // ---- Yakin Subeler (Herkese Acik) ----
  @Public()
  @Get('branches/nearby')
  @ApiOperation({ summary: 'Konuma gore yakin market subeleri bul' })
  @ApiOkResponse({ description: 'Yakin subeler mesafeye gore sirali' })
  findNearby(@Query() dto: NearbyBranchesDto) {
    return this.marketsService.findNearbyBranches(dto);
  }

  // ---- Sehirler (Herkese Acik) ----
  @Public()
  @Get('cities')
  @ApiOperation({ summary: 'Subesi olan sehirler' })
  getCities() {
    return this.marketsService.getCities();
  }

  // ---- Market Subeleri (Herkese Acik) ----
  @Public()
  @Get(':id/branches')
  @ApiOperation({ summary: 'Market subelerini listele' })
  @ApiOkResponse({ description: 'Sube listesi (varsayilan: yalnizca aktif)' })
  listBranches(
    @Param('id') marketId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.marketsService.listBranches(marketId, includeInactive === 'true');
  }

  // ---- Market Detayi (Herkese Acik) ----
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Market detayi, subeleri ve kataloglar' })
  @ApiOkResponse({ description: 'Market bilgisi, aktif subeler ve aktif kataloglar' })
  @ApiNotFoundResponse({ description: 'Market bulunamadi' })
  findOne(@Param('id') id: string) {
    return this.marketsService.findOne(id);
  }

  // ---- Market Olustur (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Yeni market olustur (Admin)' })
  @ApiCreatedResponse({ description: 'Market olusturuldu' })
  createMarket(@Body() dto: CreateMarketDto) {
    return this.marketsService.createMarket(dto);
  }

  // ---- Market Guncelle (Admin) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Market bilgilerini guncelle (Admin/Market Yoneticisi)' })
  @ApiOkResponse({ description: 'Guncellenmiş market' })
  updateMarket(@Param('id') id: string, @Body() dto: Partial<CreateMarketDto>) {
    return this.marketsService.updateMarket(id, dto);
  }

  // ---- Sube Olustur (Admin/Market Yoneticisi) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Post(':id/branches')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Markete sube ekle (Admin/Market Yoneticisi)' })
  createBranch(@Param('id') marketId: string, @Body() dto: CreateBranchDto) {
    return this.marketsService.createBranch(marketId, dto);
  }

  // ---- Sube Guncelle (Admin/Market Yoneticisi) ----
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @Patch('branches/:branchId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Sube bilgilerini guncelle' })
  @ApiOkResponse({ description: 'Guncellenmiş sube' })
  updateBranch(@Param('branchId') branchId: string, @Body() dto: Partial<CreateBranchDto>) {
    return this.marketsService.updateBranch(branchId, dto);
  }
}
