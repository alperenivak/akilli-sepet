// =====================================================
// Akıllı Sepet - Loglama Interceptor'u
// Tum HTTP isteklerini ve yanitlarini loglar
// =====================================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${duration}ms - ${ip}`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            `${method} ${url} HATA: ${error.message} - ${duration}ms - ${ip}`,
          );
        },
      }),
    );
  }
}
