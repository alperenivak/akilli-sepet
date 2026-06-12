import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class AddRewardCodesDto {
  @ApiProperty({ example: ['BIM-GOZLEM-001', 'BIM-GOZLEM-002'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  codes: string[];

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
