import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePriceAlertDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Hedef fiyat (kuruş). Örn: 2499 = 24.99 TL' })
  @IsInt()
  @Min(1)
  targetAmount: number;

  @ApiPropertyOptional({ description: 'Belirli bir market için uyarı (opsiyonel)' })
  @IsOptional()
  @IsString()
  marketId?: string;
}
