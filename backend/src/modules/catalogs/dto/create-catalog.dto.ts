import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional,
  IsDateString, MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCatalogDto {
  @ApiProperty({ description: 'Market ID (CUID)' })
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @ApiProperty({ example: 'Haftalik Indirimler - Ocak 3. Hafta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  title: string;

  @ApiPropertyOptional({ description: 'Katalog aciklamasi' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Kapak gorseli URL (S3)' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ description: 'PDF dosya URL (varsa)' })
  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @ApiProperty({ example: '2025-01-06', description: 'Gecerlilik baslangic tarihi' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-01-12', description: 'Gecerlilik bitis tarihi' })
  @IsDateString()
  endDate: string;
}
