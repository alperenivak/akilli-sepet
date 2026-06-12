// =====================================================
// Akıllı Sepet - Kayit DTO'su
// Kullanici kayit istegi veri transfer nesnesi
// =====================================================

import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Kullanicinin e-posta adresi',
    example: 'kullanici@ornek.com',
  })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  email: string;

  @ApiProperty({
    description: 'Sifre (en az 6 karakter)',
    example: 'sifre123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır' })
  @MaxLength(100, { message: 'Şifre en fazla 100 karakter olmalıdır' })
  password: string;

  @ApiProperty({
    description: 'Ad',
    example: 'Ahmet',
  })
  @IsString()
  @MinLength(2, { message: 'Ad en az 2 karakter olmalidir' })
  @MaxLength(50, { message: 'Ad en fazla 50 karakter olmalidir' })
  name: string;

  @ApiProperty({
    description: 'Soyad',
    example: 'Yilmaz',
  })
  @IsString()
  @MinLength(2, { message: 'Soyad en az 2 karakter olmalidir' })
  @MaxLength(50, { message: 'Soyad en fazla 50 karakter olmalidir' })
  surname: string;

  @ApiPropertyOptional({
    description: 'Telefon numarasi (opsiyonel)',
    example: '+905551234567',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Telefon numarası en fazla 20 karakter olmalıdır' })
  phone?: string;

  @ApiProperty({
    description: 'E-postaya gönderilen 6 haneli doğrulama kodu',
    example: '482910',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Geçerli 6 haneli doğrulama kodu giriniz' })
  verificationCode: string;
}
