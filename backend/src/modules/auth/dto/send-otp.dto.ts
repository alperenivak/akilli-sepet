import { IsEmail, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SendOtpPurpose {
  REGISTER = 'REGISTER',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export class SendOtpDto {
  @ApiProperty({ example: 'kullanici@marketapp.com' })
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  email: string;

  @ApiProperty({ enum: SendOtpPurpose, example: SendOtpPurpose.REGISTER })
  @IsEnum(SendOtpPurpose)
  purpose: SendOtpPurpose;
}
