import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsInt, IsPositive, IsOptional, IsEnum, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PriceSource } from '@prisma/client';

export class UpsertPriceDto {
  @ApiProperty({ description: 'Urun ID (CUID)' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Market ID (CUID)' })
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @ApiProperty({
    example: 2499,
    description: 'Fiyat (KURUS cinsinden - 2499 = 24.99 TL)',
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ enum: PriceSource, default: PriceSource.MANUAL_ADMIN })
  @IsOptional()
  @IsEnum(PriceSource)
  source?: PriceSource = PriceSource.MANUAL_ADMIN;

  @ApiPropertyOptional({ description: 'Urun markette mevcut mu?' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;
}
