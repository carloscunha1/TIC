import type { Prisma, Supplier } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateSupplierData = { name: string; document?: string; phone?: string; email?: string; notes?: string; actorUserId: string; ipAddress?: string };

export interface SupplierRepository { create(data: CreateSupplierData): Promise<Supplier>; }

export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly auditService: AuditService) {}

  create(data: CreateSupplierData): Promise<Supplier> {
    return prisma.$transaction(async (transaction) => {
      const supplier = await transaction.supplier.create({ data: { document: data.document, email: data.email, name: data.name, notes: data.notes, phone: data.phone } });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SUPPLIER_CREATED', after: supplier, entity: 'Supplier', entityId: supplier.id, ipAddress: data.ipAddress }, transaction);
      return supplier;
    });
  }
}
