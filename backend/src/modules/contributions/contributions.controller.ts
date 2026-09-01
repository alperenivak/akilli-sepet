import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContributionType, SubmissionStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ContributionsService } from './contributions.service';
import {
  ListContributionsDto,
  ReviewContributionDto,
  SubmitBarcodeContributionDto,
  SubmitMarketListingDto,
} from './dto/contribution.dto';

@ApiTags('contributions')
@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post('barcode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mevcut urune barkod katkisi gonder' })
  submitBarcode(@Req() req: { user: { id: string } }, @Body() dto: SubmitBarcodeContributionDto) {
    return this.contributionsService.submitBarcode(req.user.id, dto);
  }

  @Post('market-listing')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Urunu bir markette listeleme talebi gonder' })
  submitMarketListing(
    @Req() req: { user: { id: string } },
    @Body() dto: SubmitMarketListingDto,
  ) {
    return this.contributionsService.submitMarketListing(req.user.id, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kendi katkilarim' })
  listMine(
    @Req() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contributionsService.listMine(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: katki kuyrugu' })
  listAdmin(@Query() query: ListContributionsDto) {
    return this.contributionsService.listAdmin({
      type: query.type as ContributionType | undefined,
      status: query.status as SubmissionStatus | undefined,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 30,
    });
  }

  @Patch(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MARKET_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: katkiyi onayla veya reddet' })
  review(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ReviewContributionDto,
  ) {
    return this.contributionsService.review(req.user.id, id, dto);
  }
}
