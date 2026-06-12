// =====================================================
// Akıllı Sepet - Sifre Degistirme DTO
// =====================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mevcut sifre' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: 'Yeni sifre (en az 8 karakter)', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Yeni sifre en az 8 karakter olmalidir' })
  newPassword: string;
}
