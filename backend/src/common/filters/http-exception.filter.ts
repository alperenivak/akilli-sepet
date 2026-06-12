// =====================================================
// Akıllı Sepet - HTTP Istisna Filtresi
// Tum HTTP hatalarini standart formata donusturur
// =====================================================

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // HTTP durum kodunu belirle
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Sunucu hatasi olustu';
    let errors: string[] = [];

    const extraFields: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;

        // Validation pipe'dan gelen hata dizisi
        if (Array.isArray(responseObj.message)) {
          errors = responseObj.message as string[];
          message = 'Dogrulama hatasi';
        }

        // Ozel hata alanlarini koru (ornegin USER_BANNED)
        for (const key of ['error', 'bannedUntil', 'banReason', 'isPermanentBan']) {
          if (responseObj[key] !== undefined) {
            extraFields[key] = responseObj[key];
          }
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // Beklenmeyen hatalari logla
      this.logger.error(
        `Beklenmeyen hata: ${request.method} ${request.url}`,
        exception.stack,
      );
    }

    // Standart hata yaniti formatı
    const errorResponse = {
      success: false,
      statusCode: status,
      message,
      errors: errors.length > 0 ? errors : undefined,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...extraFields,
    };

    response.status(status).json(errorResponse);
  }
}
