import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNotEmpty, IsOptional, MaxLength,
  IsNumber, Min, Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateBranchDto {
  @ApiProperty({ description: 'Sube adi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ description: 'Tam adres' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: 'Lefkosa', description: 'Sehir' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'Merkez', description: 'Ilce' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiProperty({ example: 35.1856, description: 'Enlem (latitude)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 33.3823, description: 'Boylam (longitude)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ description: 'Telefon numarasi' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Calisma saatleri (orn: 08:00-22:00)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  workingHours?: string;
}
