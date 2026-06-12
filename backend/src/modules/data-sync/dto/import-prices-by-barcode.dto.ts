import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString,
  ArrayNotEmpty, ArrayMaxSize, ValidateNested, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PriceSource } from '@prisma/client';

export class PriceByBarcodeItemDto {
  @ApiProperty({ example: '8690552000001', description: 'EAN-13 barkod' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8,14}$/, { message: 'Gecerli bir barkod giriniz (8-14 rakam)' })
  barcode: string;

  @ApiProperty({ example: 'migros', description: 'Market slug' })
  @IsString()
  @IsNotEmpty()
  marketSlug: string;

  @ApiProperty({ example: 2499, description: 'Fiyat (KURUS)' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ enum: PriceSource, default: PriceSource.MANUAL_ADMIN })
  @IsOptional()
  source?: PriceSource;
}

export class ImportPricesByBarcodeDto {
  @ApiProperty({ type: [PriceByBarcodeItemDto], description: 'Maks 500 kayit' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PriceByBarcodeItemDto)
  items: PriceByBarcodeItemDto[];
}
