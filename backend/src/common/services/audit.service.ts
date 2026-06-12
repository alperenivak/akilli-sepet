import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

export interface AuditLogInput {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          oldData: input.oldData != null ? (input.oldData as object) : undefined,
          newData: input.newData != null ? (input.newData as object) : undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log yazılamadı: ${(err as Error).message}`);
    }
  }

  logFromRequest(
    user: AuthenticatedUser | undefined,
    req: { method: string; url: string; ip?: string; headers?: Record<string, unknown>; body?: unknown },
    entityType?: string,
    entityId?: string,
  ): Promise<void> {
    if (!user) return Promise.resolve();

    const action = `${req.method} ${req.url.split('?')[0]}`;
    const ua = req.headers?.['user-agent'];
    return this.log({
      userId: user.id,
      action,
      entityType,
      entityId,
      newData: this.sanitizeBody(req.body),
      ipAddress: req.ip,
      userAgent: typeof ua === 'string' ? ua : undefined,
    });
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const copy = { ...(body as Record<string, unknown>) };
    for (const key of ['password', 'token', 'refreshToken', 'otp', 'code']) {
      if (key in copy) copy[key] = '[REDACTED]';
    }
    return copy;
  }
}
