import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BanUserDto {
  @ApiPropertyOptional({ description: 'Kalici ban uygula' })
  @IsOptional()
  @IsBoolean()
  isPermanent?: boolean;

  @ApiPropertyOptional({ description: 'Ban suresi (dakika), gecici ban icin zorunlu' })
  @ValidateIf((o) => !o.isPermanent)
  @IsInt()
  @Min(1)
  @Max(43200)
  durationMinutes?: number;

  @ApiProperty({ description: 'Ban sebebi (zorunlu)' })
  @IsString()
  @MinLength(3, { message: 'Ban sebebi en az 3 karakter olmalidir' })
  reason: string;
}
