// =====================================================
// Akıllı Sepet - Market Servisi
// Market CRUD, sube yonetimi, konum bazli arama
// =====================================================

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { NearbyBranchesDto } from './dto/nearby-branches.dto';

// Cografi sabitleri
const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111;
const DEFAULT_NEARBY_RADIUS_KM = 5;
const MAX_CATALOG_PREVIEW = 5;

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Tum Aktif Marketler ----
  async findAll() {
    return this.prisma.market.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { branches: true, catalogs: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ---- Market Subeleri Listele ----
  async listBranches(marketId: string, includeInactive = false) {
    const market = await this.prisma.market.findUnique({
      where: { id: marketId },
      select: { id: true },
    });
    if (!market) throw new NotFoundException('Market bulunamadi');

    return this.prisma.marketBranch.findMany({
      where: {
        marketId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ city: 'asc' }, { district: 'asc' }, { name: 'asc' }],
    });
  }

  // ---- Market Detayi ----
  async findOne(id: string) {
    const market = await this.prisma.market.findUnique({
      where: { id },
      include: {
        branches: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        catalogs: {
          where: { isActive: true, endDate: { gte: new Date() } },
          orderBy: { startDate: 'desc' },
          take: MAX_CATALOG_PREVIEW,
        },
        _count: { select: { branches: true } },
      },
    });

    if (!market) throw new NotFoundException('Market bulunamadi');
    return market;
  }

  // ---- Market Olustur ----
  async createMarket(dto: CreateMarketDto) {
    // Slug otomatik uret veya verileni kullan
    const slug = dto.slug ?? this.generateSlug(dto.name);

    const existing = await this.prisma.market.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`"${slug}" slug'i zaten kullaniliyor`);

    return this.prisma.market.create({
      data: { ...dto, slug },
    });
  }

  // ---- Market Guncelle ----
  async updateMarket(id: string, dto: Partial<CreateMarketDto>) {
    await this.findOne(id);
    return this.prisma.market.update({
      where: { id },
      data: dto,
    });
  }

  // ---- Sube Olustur ----
  async createBranch(marketId: string, dto: CreateBranchDto) {
    await this.findOne(marketId); // Market var mi?

    return this.prisma.marketBranch.create({
      data: {
        marketId,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        district: dto.district ?? null,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone ?? null,
        workingHours: dto.workingHours ?? null,
      },
      include: { market: { select: { id: true, name: true, brandColor: true } } },
    });
  }

  // ---- Sube Guncelle ----
  async updateBranch(branchId: string, dto: Partial<CreateBranchDto>) {
    const branch = await this.prisma.marketBranch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException('Sube bulunamadi');

    return this.prisma.marketBranch.update({
      where: { id: branchId },
      data: dto,
    });
  }

  // ---- Yakin Subeler (Haversine Formulu) ----
  // Veritabani seviyesinde mesafe hesabi yerine uygulama katmaninda yapiyoruz
  // (PostGIS kurulmadan calisabilmesi icin)
  async findNearbyBranches(dto: NearbyBranchesDto) {
    const { lat, lng, radiusKm = DEFAULT_NEARBY_RADIUS_KM } = dto;

    // Yaklasik koordinat kutusu olustur (1 derece enlem ~111 km)
    const latDelta = radiusKm / KM_PER_DEGREE_LAT;
    const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

    const branches = await this.prisma.marketBranch.findMany({
      where: {
        isActive: true,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: {
        market: { select: { id: true, name: true, logoUrl: true, brandColor: true } },
      },
    });

    // Gercek Haversine mesafesini hesapla ve sirala
    const withDistance = branches
      .map((branch) => ({
        ...branch,
        distanceKm: this.haversineDistance(lat, lng, branch.latitude ?? 0, branch.longitude ?? 0),
      }))
      .filter((b) => b.distanceKm <= radiusKm && b.latitude !== null && b.longitude !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return withDistance;
  }

  // ---- Sehirler Listesi ----
  async getCities() {
    const result = await this.prisma.marketBranch.findMany({
      where: { isActive: true },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    return result.map((r) => r.city);
  }

  // ---- Yardimci: Haversine mesafe formulu (km) ----
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = EARTH_RADIUS_KM;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ---- Yardimci: slug olustur ----
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
