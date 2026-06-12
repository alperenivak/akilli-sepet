import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class UpdateReportStatusDto {
  @ApiProperty({
    enum: ReportStatus,
    description: 'Yeni ihbar durumu',
    example: ReportStatus.APPROVED,
  })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({
    description: 'Kullaniciya gosterilecek yanit notu (maks 500 karakter)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userNote?: string;
}
