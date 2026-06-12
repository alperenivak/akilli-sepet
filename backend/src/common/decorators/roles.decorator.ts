// =====================================================
// Akıllı Sepet - Rol Decorator'u
// Endpoint'lere gerekli rol kisitlamalarini eklemek icin
// =====================================================

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Metadata anahtari
export const ROLES_KEY = 'roles';

// Rol dekoratoru - belirtilen rollerin endpoint'e erisebilmesi icin
// Kullanim: @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
