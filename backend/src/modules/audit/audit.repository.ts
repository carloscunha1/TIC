import { prisma } from '../../infrastructure/database/prisma.js';
import type { Prisma } from '@prisma/client';

export type AuditCreateData = {
  actorType: 'USER' | 'SYSTEM';
  actorUserId?: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  ipAddress?: string;
};

export interface AuditRepository {
  create(data: AuditCreateData, transaction?: Prisma.TransactionClient): Promise<void>;
}

export class PrismaAuditRepository implements AuditRepository {
  async create(data: AuditCreateData, transaction = prisma): Promise<void> {
    await transaction.auditLog.create({ data });
  }
}
