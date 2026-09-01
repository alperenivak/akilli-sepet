import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BarcodeFormat,
  ContributionType,
  PriceSource,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { ReputationService } from '../users/reputation.service';
import { validateBarcodeCode } from './barcode.util';
import {
  ReviewContributionDto,
  SubmitBarcodeContributionDto,
  SubmitMarketListingDto,
} from './dto/contribution.dto';

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reputation: ReputationService,
  ) {}

  async submitBarcode(userId: string, dto: SubmitBarcodeContributionDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, isActive: true },
      select: { id: true, name: true, barcodes: { select: { code: true } } },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı');

    let parsed: { code: string; format: BarcodeFormat };
    try {
      parsed = validateBarcodeCode(dto.code);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }

    if (product.barcodes.some((b) => b.code === parsed.code)) {
      throw new ConflictException('Bu barkod zaten bu ürüne bağlı');
    }

    const existingBarcode = await this.prisma.barcode.findUnique({
      where: { code: parsed.code },
      include: { product: { select: { name: true } } },
    });
    if (existingBarcode && existingBarcode.productId !== product.id) {
      throw new ConflictException(
        `Bu barkod başka bir ürüne bağlı: ${existingBarcode.product.name}`,
      );
    }

    const pendingDuplicate = await this.prisma.productContribution.findFirst({
      where: {
        type: ContributionType.BARCODE,
        status: SubmissionStatus.PENDING,
        OR: [
          { productId: product.id, barcode: parsed.code },
          { barcode: parsed.code },
        ],
      },
    });
    if (pendingDuplicate) {
      throw new ConflictException('Bu barkod için zaten bekleyen bir katkı var');
    }

    const contribution = await this.prisma.productContribution.create({
      data: {
        type: ContributionType.BARCODE,
        userId,
        productId: product.id,
        barcode: parsed.code,
        barcodeFormat: parsed.format,
        note: dto.note?.trim() || null,
      },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    });

    const rep = await this.reputation.awardSubmitBarcode(userId, product.name, parsed.code);

    return {
      contribution,
      message: 'Barkod katkın incelenmek üzere alındı. Onaylandığında +0.35 itibar kazanacaksın.',
      reputation: rep,
    };
  }

  async submitMarketListing(userId: string, dto: SubmitMarketListingDto) {
    const [product, market] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: dto.productId, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.market.findUnique({
        where: { id: dto.marketId, isActive: true },
        select: { id: true, name: true, slug: true },
      }),
    ]);
    if (!product) throw new NotFoundException('Ürün bulunamadı');
    if (!market) throw new NotFoundException('Market bulunamadı');

    const existingPrice = await this.prisma.price.findUnique({
      where: { productId_marketId: { productId: product.id, marketId: market.id } },
    });
    if (existingPrice?.isAvailable) {
      throw new ConflictException(
        'Bu ürün seçilen markette zaten listeleniyor. Fiyat güncellemek için fiyat bildir ekranını kullanın.',
      );
    }

    const pending = await this.prisma.productContribution.findFirst({
      where: {
        type: ContributionType.MARKET_LISTING,
        status: SubmissionStatus.PENDING,
        productId: product.id,
        marketId: market.id,
      },
    });
    if (pending) {
      throw new ConflictException('Bu ürün için seçilen markette zaten bekleyen bir talep var');
    }

    const contribution = await this.prisma.productContribution.create({
      data: {
        type: ContributionType.MARKET_LISTING,
        userId,
        productId: product.id,
        marketId: market.id,
        amount: dto.amount,
        note: dto.note?.trim() || null,
      },
      include: {
        product: { select: { id: true, name: true, imageUrl: true, brand: true } },
        market: { select: { id: true, name: true, logoUrl: true } },
      },
    });

    const rep = await this.reputation.awardSubmitMarketListing(
      userId,
      product.name,
      market.name,
    );

    return {
      contribution,
      message: 'Ürün markete ekleme talebin alındı. Onaylandığında +0.40 itibar kazanacaksın.',
      reputation: rep,
    };
  }

  async listMine(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.productContribution.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
          market: { select: { id: true, name: true } },
        },
      }),
      this.prisma.productContribution.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  async listAdmin(filters: {
    type?: ContributionType;
    status?: SubmissionStatus;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 30;
    const skip = (page - 1) * limit;
    const where = {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [items, total, pendingBarcode, pendingListing] = await Promise.all([
      this.prisma.productContribution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, imageUrl: true, brand: true } },
          market: { select: { id: true, name: true, logoUrl: true } },
          user: {
            select: {
              id: true, name: true, surname: true, email: true, reputationScore: true,
            },
          },
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.productContribution.count({ where }),
      this.prisma.productContribution.count({
        where: { status: SubmissionStatus.PENDING, type: ContributionType.BARCODE },
      }),
      this.prisma.productContribution.count({
        where: { status: SubmissionStatus.PENDING, type: ContributionType.MARKET_LISTING },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      stats: { pendingBarcode, pendingListing, pendingTotal: pendingBarcode + pendingListing },
    };
  }

  async review(adminId: string, id: string, dto: ReviewContributionDto) {
    const contribution = await this.prisma.productContribution.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
        user: { select: { id: true } },
      },
    });
    if (!contribution) throw new NotFoundException('Katkı bulunamadı');
    if (contribution.status !== SubmissionStatus.PENDING) {
      throw new ForbiddenException('Bu katkı zaten incelendi');
    }

    if (dto.decision === 'APPROVED') {
      if (contribution.type === ContributionType.BARCODE) {
        await this.applyBarcodeApproval(contribution);
      } else {
        await this.applyMarketListingApproval(contribution);
      }
    }

    const updated = await this.prisma.productContribution.update({
      where: { id },
      data: {
        status: dto.decision as SubmissionStatus,
        adminNote: dto.adminNote?.trim() || null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
      include: {
        product: { select: { id: true, name: true } },
        market: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, surname: true, email: true } },
      },
    });

    if (contribution.userId) {
      if (contribution.type === ContributionType.BARCODE && contribution.barcode) {
        if (dto.decision === 'APPROVED') {
          await this.reputation.awardSubmitBarcodeApproved(
            contribution.userId,
            contribution.product.name,
            contribution.barcode,
          );
        } else {
          await this.reputation.awardSubmitBarcodeRejected(
            contribution.userId,
            contribution.product.name,
            contribution.barcode,
          );
        }
      } else if (contribution.type === ContributionType.MARKET_LISTING && contribution.market) {
        if (dto.decision === 'APPROVED') {
          await this.reputation.awardSubmitMarketListingApproved(
            contribution.userId,
            contribution.product.name,
            contribution.market.name,
          );
        } else {
          await this.reputation.awardSubmitMarketListingRejected(
            contribution.userId,
            contribution.product.name,
            contribution.market.name,
          );
        }
      }
    }

    return updated;
  }

  private async applyBarcodeApproval(contribution: {
    id: string;
    productId: string;
    barcode: string | null;
    barcodeFormat: BarcodeFormat | null;
  }) {
    if (!contribution.barcode || !contribution.barcodeFormat) {
      throw new BadRequestException('Barkod bilgisi eksik');
    }

    const duplicate = await this.prisma.barcode.findUnique({
      where: { code: contribution.barcode },
    });
    if (duplicate) {
      throw new ConflictException('Barkod başka bir ürüne bağlı — onaylanamadı');
    }

    const barcode = await this.prisma.barcode.create({
      data: {
        code: contribution.barcode,
        format: contribution.barcodeFormat,
        productId: contribution.productId,
      },
    });

    await this.prisma.productContribution.update({
      where: { id: contribution.id },
      data: { createdBarcodeId: barcode.id },
    });
  }

  private async applyMarketListingApproval(contribution: {
    id: string;
    productId: string;
    marketId: string | null;
    amount: number | null;
  }) {
    if (!contribution.marketId || !contribution.amount) {
      throw new BadRequestException('Market veya fiyat bilgisi eksik');
    }

    const existing = await this.prisma.price.findUnique({
      where: {
        productId_marketId: {
          productId: contribution.productId,
          marketId: contribution.marketId,
        },
      },
    });

    let priceId: string;
    if (existing) {
      const updated = await this.prisma.price.update({
        where: { id: existing.id },
        data: {
          amount: contribution.amount,
          isAvailable: true,
          needsVerification: false,
          confidenceScore: 0.75,
          source: PriceSource.CROWDSOURCE,
          lastUpdated: new Date(),
        },
      });
      priceId = updated.id;
    } else {
      const created = await this.prisma.price.create({
        data: {
          productId: contribution.productId,
          marketId: contribution.marketId,
          amount: contribution.amount,
          isAvailable: true,
          needsVerification: false,
          confidenceScore: 0.75,
          source: PriceSource.CROWDSOURCE,
        },
      });
      priceId = created.id;
    }

    await this.prisma.productContribution.update({
      where: { id: contribution.id },
      data: { createdPriceId: priceId },
    });
  }
}
