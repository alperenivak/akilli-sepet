import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_KEY = 'audit_entity';

/** Admin/market manager mutasyonlarında audit log entity bilgisi */
export const AuditEntity = (type: string, idParam = 'id') =>
  SetMetadata(AUDIT_ENTITY_KEY, { type, idParam });
