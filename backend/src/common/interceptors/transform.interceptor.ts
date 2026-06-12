// =====================================================
// Akıllı Sepet - Yanit Donusturme Interceptor'u
// Tum basarili yanitleri standart formata sarar
// =====================================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Standart basarili yanit formati
export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // Eger data zaten {success, data, message} formatindaysa aynen don
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Aksi halde standart formata sar
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
