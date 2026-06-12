// =====================================================
// Akıllı Sepet - Rol Tabanli Yetkilendirme Guard'i
// Kullanicinin gereken role sahip olup olmadigini kontrol eder
// =====================================================

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Endpoint icin gerekli rolleri al
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Rol kisitlamasi yoksa erisime izin ver
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Kimlik dogrulama gerekli');
    }

    // SUPER_ADMIN her seye erisebilir
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Kullanicinin rolunun gerekli roller arasinda olup olmadigini kontrol et
    const hasRole = requiredRoles.includes(user.role as UserRole);

    if (!hasRole) {
      throw new ForbiddenException(
        'Bu islemi gerceklestirmek icin yeterli yetkiniz bulunmuyor.',
      );
    }

    return true;
  }
}
