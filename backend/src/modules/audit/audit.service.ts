import type { Prisma } from '@prisma/client';
import type { AuditRepository } from './audit.repository.js';

const SENSITIVE_KEY = /(password|passwd|pin|token|secret|credential|authorization)/i;

export type AuditActor = { type: 'USER'; userId: string } | { type: 'SYSTEM' };

export type AuditEvent = {
  actor: AuditActor;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
};

export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  record(event: AuditEvent, transaction?: Prisma.TransactionClient): Promise<void> {
    return this.auditRepository.create({
      action: event.action,
      actorType: event.actor.type,
      actorUserId: event.actor.type === 'USER' ? event.actor.userId : undefined,
      afterData: sanitizeAuditData(event.after),
      beforeData: sanitizeAuditData(event.before),
      entity: event.entity,
      entityId: event.entityId,
      ipAddress: event.ipAddress,
    }, transaction);
  }
}

export function sanitizeAuditData(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return sanitizeValue(value) as Prisma.InputJsonValue;
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeValue(nestedValue)]));
  }
  return value;
}
