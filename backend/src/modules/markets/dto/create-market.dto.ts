import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMarketDto {
  @ApiProperty({ example: 'Migros', description: 'Market adi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({ example: 'migros', description: 'URL dostu benzersiz slug' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug sadece kucuk harf, rakam ve tire icermelidir' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Logo gorsel URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#F7892B', description: 'Marka rengi (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Gecerli bir hex renk kodu giriniz (#RRGGBB)' })
  brandColor?: string;

  @ApiPropertyOptional({ description: 'Market aciklamasi' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://www.migros.com.tr' })
  @IsOptional()
  @IsString()
  website?: string;
}
