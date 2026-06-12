import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength,
} from 'class-validator';
import { RewardCodeMode } from '@prisma/client';

export class CreateRewardDto {
  @ApiProperty({ example: 'bim-ozel-indirim' })
  @IsString()
  @MinLength(3)
  slug: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  benefitText: string;

  @ApiProperty({ example: '%5 İndirim' })
  @IsString()
  discountLabel: string;

  @ApiProperty({ example: 2.0 })
  @IsNumber()
  @Min(0)
  minReputation: number;

  @ApiProperty()
  @IsString()
  levelLabel: string;

  @ApiProperty({ example: '🎯' })
  @IsString()
  levelIcon: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marketId?: string;

  @ApiPropertyOptional({ enum: RewardCodeMode })
  @IsOptional()
  @IsEnum(RewardCodeMode)
  codeMode?: RewardCodeMode;

  @ApiPropertyOptional({ example: 'BIM' })
  @IsOptional()
  @IsString()
  codePrefix?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  autoExpiresDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
