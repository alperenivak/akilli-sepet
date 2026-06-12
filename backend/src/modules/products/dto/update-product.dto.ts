import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

// CreateProductDto'dan barcodes haric hepsini opsiyonel yap
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['barcodes'] as const),
) {
  @ApiPropertyOptional({ description: 'Urunu aktif/pasif yap' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
