// =====================================================
// Akıllı Sepet - Public Endpoint Decorator'u
// JWT dogrulamasi gerektirmeyen endpoint'leri isaretler
// =====================================================

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Bu decorator ile isaretlenen endpoint'ler JWT dogrulamasi gerektirmez
// Kullanim: @Public() getProducts() { ... }
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
