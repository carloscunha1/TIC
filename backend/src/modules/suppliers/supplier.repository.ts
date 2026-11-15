import type { Prisma, Supplier, SupplierStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateSupplierData = { name: string; document?: string; phone?: string; email?: string; notes?: string; actorUserId: string; ipAddress?: string };
export type SupplierListFilters = { page: number; pageSize: number; name?: string; status?: SupplierStatus };
export type SupplierListResult = { suppliers: Supplier[]; total: number };

export interface SupplierRepository { create(data: CreateSupplierData): Promise<Supplier>; list(filters: SupplierListFilters): Promise<SupplierListResult>; findById(id: string): Promise<Supplier | null>; update(id: string, data: Omit<CreateSupplierData, 'actorUserId'> & { actorUserId: string }): Promise<Supplier>; updateStatus(id: string, status: SupplierStatus, actorUserId: string, ipAddress?: string): Promise<Supplier>; }

export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly auditService: AuditService) {}

  create(data: CreateSupplierData): Promise<Supplier> {
    return prisma.$transaction(async (transaction) => {
      const supplier = await transaction.supplier.create({ data: { document: data.document, email: data.email, name: data.name, notes: data.notes, phone: data.phone } });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SUPPLIER_CREATED', after: supplier, entity: 'Supplier', entityId: supplier.id, ipAddress: data.ipAddress }, transaction);
      return supplier;
    });
  }

  async list(filters: SupplierListFilters): Promise<SupplierListResult> {
    const where: Prisma.SupplierWhereInput = {};
    if (filters.name) where.name = { contains: filters.name, mode: 'insensitive' };
    if (filters.status) where.status = filters.status;
    const [suppliers, total] = await prisma.$transaction([
      prisma.supplier.findMany({ orderBy: [{ name: 'asc' }, { createdAt: 'desc' }], skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize, where }),
      prisma.supplier.count({ where }),
    ]);
    return { suppliers, total };
  }

  findById(id: string): Promise<Supplier | null> { return prisma.supplier.findUnique({ where: { id } }); }

  update(id: string, data: Omit<CreateSupplierData, 'actorUserId'> & { actorUserId: string }): Promise<Supplier> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.supplier.findUnique({ where: { id } });
      if (!before) throw new Error('SUPPLIER_NOT_FOUND');
      const supplier = await transaction.supplier.update({ where: { id }, data: { document: data.document, email: data.email, name: data.name, notes: data.notes, phone: data.phone } });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SUPPLIER_UPDATED', before, after: supplier, entity: 'Supplier', entityId: id, ipAddress: data.ipAddress }, transaction);
      return supplier;
    });
  }

  updateStatus(id: string, status: SupplierStatus, actorUserId: string, ipAddress?: string): Promise<Supplier> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.supplier.findUnique({ where: { id } });
      if (!before) throw new Error('SUPPLIER_NOT_FOUND');
      const supplier = await transaction.supplier.update({ where: { id }, data: { status } });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'SUPPLIER_STATUS_UPDATED', before, after: supplier, entity: 'Supplier', entityId: id, ipAddress }, transaction);
      return supplier;
    });
  }
}
