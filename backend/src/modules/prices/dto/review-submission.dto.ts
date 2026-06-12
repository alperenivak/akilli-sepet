import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReviewDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewSubmissionDto {
  @ApiProperty({ enum: ReviewDecision, description: 'Admin karari' })
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @ApiPropertyOptional({ description: 'Admin notu' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
