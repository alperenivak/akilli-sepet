import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCartItemDto {
  @ApiProperty({ example: 3, description: 'Yeni adet (0 = kaldir)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  quantity: number;
}
