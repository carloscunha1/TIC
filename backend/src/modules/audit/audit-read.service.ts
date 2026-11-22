import type { AuditListQuery } from './audit.schemas.js';
import type { AuditReadRepository } from './audit-read.repository.js';

const SENSITIVE_KEY = /(password|passwd|pin|token|secret|credential|authorization)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) =>
      [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize(nested)],
    ));
  }
  return value;
}

export class AuditReadService {
  constructor(private readonly repository: AuditReadRepository) {}

  async list(query: AuditListQuery) {
    const result = await this.repository.list(query);
    return {
      logs: result.logs.map((log) => ({
        id: log.id,
        actorType: log.actorType,
        actor: log.actorUser ? { id: log.actorUser.id, name: log.actorUser.name } : null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        before: sanitize(log.beforeData),
        after: sanitize(log.afterData),
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(result.total / query.pageSize),
    };
  }
}
