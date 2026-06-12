import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class PriceAlertQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'triggered', 'all'], default: 'all' })
  @IsOptional()
  @IsIn(['active', 'triggered', 'all'])
  status?: 'active' | 'triggered' | 'all';

  @ApiPropertyOptional({ description: 'Belirli urun icin uyari' })
  @IsOptional()
  @IsString()
  productId?: string;
}
