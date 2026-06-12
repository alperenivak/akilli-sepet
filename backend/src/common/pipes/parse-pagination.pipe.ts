// =====================================================
// Akıllı Sepet - Sayfalama Parametresi Pipe'i
// Sayfalama parametrelerini duzenleme ve dogrulama
// =====================================================

import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class ParsePaginationPipe implements PipeTransform {
  transform(value: { page?: string | number; limit?: string | number }): PaginationParams {
    const page = Math.max(1, parseInt(String(value?.page || 1), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(value?.limit || 20), 10)));

    if (isNaN(page) || isNaN(limit)) {
      throw new BadRequestException('Gecersiz sayfalama parametresi');
    }

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }
}
