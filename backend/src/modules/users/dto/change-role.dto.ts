// =====================================================
// Akıllı Sepet - Rol Degistirme DTO
// =====================================================

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole, description: 'Yeni kullanici rolu' })
  @IsEnum(UserRole, { message: 'Gecersiz kullanici rolu' })
  role: UserRole;
}
