import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditListQuery } from './audit.schemas.js';

export interface AuditReadRepository {
  list(query: AuditListQuery): Promise<{ logs: AuditReadLog[]; total: number }>;
}

export type AuditReadLog = Prisma.AuditLogGetPayload<{ include: { actorUser: { select: { id: true; name: true; email: true } } } }>;

export class PrismaAuditReadRepository implements AuditReadRepository {
  async list(query: AuditListQuery): Promise<{ logs: AuditReadLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.entity ? { entity: { contains: query.entity, mode: 'insensitive' } } : {}),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: { actorUser: { select: { id: true, name: true, email: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { logs, total };
  }
}
