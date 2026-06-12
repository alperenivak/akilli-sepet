import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsPositive, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCatalogPageDto {
  @ApiProperty({ example: 1, description: 'Sayfa numarasi' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  pageNumber: number;

  @ApiProperty({ description: 'Tam boyutlu gorsel URL (S3)' })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiPropertyOptional({ description: 'Kucuk onizleme gorsel URL (S3)' })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}
