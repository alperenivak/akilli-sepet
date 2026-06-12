// =====================================================
// Akıllı Sepet - Giris DTO'su
// Kullanici giris istegi veri transfer nesnesi
// =====================================================

import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Kayitli e-posta adresi',
    example: 'kullanici@ornek.com',
  })
  @IsEmail({}, { message: 'Gecerli bir e-posta adresi giriniz' })
  email: string;

  @ApiProperty({
    description: 'Hesap sifresi',
    example: 'Guclu1Sifre!',
  })
  @IsString()
  @MinLength(1, { message: 'Sifre bos birakilamaz' })
  password: string;
}
