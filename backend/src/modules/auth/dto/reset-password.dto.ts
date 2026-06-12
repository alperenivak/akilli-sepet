import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'kullanici@marketapp.com' })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  email: string;

  @ApiProperty({ description: 'E-postaya gönderilen 6 haneli kod', example: '482910' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Geçerli 6 haneli doğrulama kodu giriniz' })
  verificationCode: string;

  @ApiProperty({ minLength: 6, example: 'YeniSifre123' })
  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır' })
  @MaxLength(100)
  newPassword: string;
}
