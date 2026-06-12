import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { BarcodeFormat } from '@prisma/client';

export class AddBarcodeDto {
  @ApiProperty({ example: '8690001000001', description: 'Barkod degeri' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;

  @ApiPropertyOptional({ enum: BarcodeFormat, default: BarcodeFormat.EAN_13 })
  @IsOptional()
  @IsEnum(BarcodeFormat)
  format?: BarcodeFormat = BarcodeFormat.EAN_13;
}
