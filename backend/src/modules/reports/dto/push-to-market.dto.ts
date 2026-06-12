import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class PushToMarketDto {
  @ApiProperty({ description: 'Ihbarin iletilecegi market ID' })
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @ApiPropertyOptional({ description: 'Sube ID (opsiyonel)' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Market yoneticisine iletilecek not (kullanici gormez)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  marketNote?: string;
}
