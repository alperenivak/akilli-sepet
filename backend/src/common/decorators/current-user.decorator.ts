// =====================================================
// Akıllı Sepet - Mevcut Kullanici Decorator'u
// Controller metodlarinda JWT'den kullanici bilgisini elde etmek icin
// =====================================================

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '@prisma/client';

// Kimlik dogrulama sonrasi request nesnesine eklenen kullanici bilgisi
// role: string degil UserRole enum — RolesGuard ile tip uyumlulugu saglar
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string | null;
  surname?: string | null;
  isActive?: boolean;
}

// Kullanici bilgisini parametre olarak almak icin decorator
// Kullanim: @CurrentUser() user: AuthenticatedUser
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;

    // Belirli bir alan isteniyorsa sadece onu don
    return data ? user?.[data] : user;
  },
);
