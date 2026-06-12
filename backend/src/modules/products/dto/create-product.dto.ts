import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional,
  IsNumber, IsPositive, MaxLength, IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Erikli Su 1.5L', description: 'Urun adi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({ example: 'Erikli', description: 'Marka adi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  brand?: string;

  @ApiPropertyOptional({ description: 'Urun aciklamasi' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Kategori ID (CUID)' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ example: 'litre', description: 'Olcu birimi' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ example: 1.5, description: 'Birim degeri' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitValue?: number;

  @ApiPropertyOptional({ description: 'Urun ana gorseli URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['8690001000001'],
    description: 'Eklenecek barkodlar',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  barcodes?: string[];
}
