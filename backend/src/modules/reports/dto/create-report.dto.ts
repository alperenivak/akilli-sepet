import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, IsBoolean,
  IsArray, MaxLength, IsNumber,
  Min, Max, ArrayMaxSize, Matches,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateReportDto {
  @ApiPropertyOptional({ description: 'Barkod kodu (urun bilinmiyorsa)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcodeCode?: string;

  @ApiPropertyOptional({ description: 'Urun ID (CUID, sistem urunuyse)' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ description: 'Market ID (CUID)' })
  @IsOptional()
  @IsString()
  marketId?: string;

  @ApiPropertyOptional({ description: 'Sube ID (CUID)' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Listede olmayan market adi (kullanici yazili bildirim)',
    example: 'Mahalle Bakkali - Lefkosa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  marketNameOther?: string;

  @ApiProperty({
    example: 'Migros Lefkosa subesi rafinda tarihi gecmis sut var',
    description: 'Ihbar aciklamasi (min 10, maks 1000 karakter)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  description: string;

  @ApiPropertyOptional({ description: 'Son kullanma tarihi (YYYY-MM-DD veya GG.AA.YYYY)' })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})$/, {
    message: 'Son kullanma tarihi GG.AA.YYYY veya YYYY-MM-DD formatinda olmalidir',
  })
  @Transform(({ value }) => {
    if (!value || typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(trimmed);
    if (tr) return `${tr[3]}-${tr[2]}-${tr[1]}`;
    return trimmed;
  })
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Enlem' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Boylam' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Acik adres' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: 'Sehir' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'Ilce' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({ description: 'Anonim ihbar gonder mi?' })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean = false;

  @ApiPropertyOptional({
    type: [String],
    description: 'S3\'e yuklenmis gorsel URL\'leri (maks 5)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  imageUrls?: string[];
}
