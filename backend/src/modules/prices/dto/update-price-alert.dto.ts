import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePriceAlertDto {
  @ApiPropertyOptional({ description: 'Hedef fiyat (kuruş)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetAmount?: number;

  @ApiPropertyOptional({ description: 'Market ID — null/bos = tum marketler' })
  @IsOptional()
  @IsString()
  marketId?: string | null;
}
