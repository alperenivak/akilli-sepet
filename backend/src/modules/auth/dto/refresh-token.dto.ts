// =====================================================
// Akıllı Sepet - Token Yenileme DTO
// =====================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Kullanici ID (CUID)', example: 'clo4d1234000abc' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Gecerli refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
