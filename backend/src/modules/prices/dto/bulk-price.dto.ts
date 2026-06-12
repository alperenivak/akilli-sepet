import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertPriceDto } from './upsert-price.dto';

export class BulkPriceDto {
  @ApiProperty({
    type: [UpsertPriceDto],
    description: 'Toplu fiyat listesi (maks 500)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertPriceDto)
  prices: UpsertPriceDto[];
}
