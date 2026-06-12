import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ProductSortBy {
  NAME        = 'name',
  BRAND       = 'brand',
  CATEGORY    = 'category',
  CREATED_AT  = 'createdAt',
  EXPIRY_DATE = 'expiryDate',
  PRICE       = 'price',
}

export enum SortOrder {
  ASC  = 'asc',
  DESC = 'desc',
}

export class ProductFilterDto {
  @ApiPropertyOptional({ description: 'Ad, marka veya barkod ile ara' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({ description: 'Kategori ID (CUID) filtresi' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Marka filtresi' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Belirli bir markette fiyati olan urunler' })
  @IsOptional()
  @IsString()
  marketId?: string;

  @ApiPropertyOptional({ description: 'Aktif/Pasif filtresi (belirtilmezse tüm ürünler)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Math.min(parseInt(value, 10) || 20, 100))
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ProductSortBy, default: ProductSortBy.CREATED_AT })
  @IsOptional()
  @IsEnum(ProductSortBy)
  sortBy?: ProductSortBy = ProductSortBy.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
