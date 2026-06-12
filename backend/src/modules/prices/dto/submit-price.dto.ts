import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsOptional, MaxLength } from 'class-validator';

export class SubmitPriceDto {
  @ApiProperty({ description: 'Urun ID' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Market ID' })
  @IsString()
  marketId: string;

  @ApiProperty({ description: 'Fiyat (kurus cinsinden, 29.99 TL = 2999)', example: 2999 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Opsiyonel not (market sube, tarih vb.)' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
