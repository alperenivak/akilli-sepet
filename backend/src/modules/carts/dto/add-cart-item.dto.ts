import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCartItemDto {
  @ApiProperty({ description: 'Sepete eklenecek urunun ID (CUID)' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Urunun eklenecegi market ID (CUID)' })
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @ApiPropertyOptional({ example: 1, description: 'Adet (varsayilan: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number = 1;
}
