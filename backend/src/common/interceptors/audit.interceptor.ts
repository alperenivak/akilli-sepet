import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuditService } from '../services/audit.service';
import { AUDIT_ENTITY_KEY } from '../decorators/audit.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ADMIN_ROLES = new Set<UserRole>([
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.MARKET_MANAGER,
]);

const AUDITED_PREFIXES = [
  '/api/products',
  '/api/markets',
  '/api/catalogs',
  '/api/prices',
  '/api/users',
  '/api/admin',
  '/api/reports',
  '/api/rewards',
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;
    const method = req.method as string;
    const path = (req.originalUrl ?? req.url ?? '') as string;

    const shouldAudit =
      MUTATING.has(method)
      && user
      && ADMIN_ROLES.has(user.role)
      && AUDITED_PREFIXES.some((p) => path.startsWith(p))
      && !path.startsWith('/api/auth');

    if (!shouldAudit) return next.handle();

    const entityMeta = this.reflector.get<{ type: string; idParam?: string }>(
      AUDIT_ENTITY_KEY,
      context.getHandler(),
    );
    const entityId = entityMeta?.idParam
      ? (req.params?.[entityMeta.idParam] as string | undefined)
      : (req.params?.id as string | undefined);

    return next.handle().pipe(
      tap(() => {
        void this.audit.logFromRequest(
          user,
          { method, url: path, ip: req.ip, headers: req.headers, body: req.body },
          entityMeta?.type ?? this.guessEntityType(path),
          entityId,
        );
      }),
    );
  }

  private guessEntityType(path: string): string | undefined {
    if (path.includes('/catalogs')) return 'Catalog';
    if (path.includes('/products')) return 'Product';
    if (path.includes('/markets')) return 'Market';
    if (path.includes('/prices')) return 'Price';
    if (path.includes('/users')) return 'User';
    if (path.includes('/reports')) return 'Report';
    if (path.includes('/rewards')) return 'Reward';
    return undefined;
  }
}
