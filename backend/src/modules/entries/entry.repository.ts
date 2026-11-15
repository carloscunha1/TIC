import { Prisma, type EntryStatus, type Product, type Supplier } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';
import type { EntryDraftInput } from './entry.schemas.js';

export type EntryWriteData = EntryDraftInput & { actorUserId: string; ipAddress?: string };
export type EntryWithItems = Prisma.EntryGetPayload<{ include: { supplier: { select: { id: true; name: true } }; items: { include: { product: { select: { id: true; name: true; unit: true; stockMode: true } } } } } }>;
export type EntrySummary = Prisma.EntryGetPayload<{ include: { supplier: { select: { name: true } }; _count: { select: { items: true } } } }>;

export interface EntryRepository {
  findActiveSupplier(id: string): Promise<Supplier | null>;
  findActiveProducts(ids: string[]): Promise<Product[]>;
  createDraft(data: EntryWriteData): Promise<EntryWithItems>;
  updateDraft(id: string, data: EntryWriteData): Promise<EntryWithItems | null>;
  findById(id: string): Promise<EntryWithItems | null>;
  list(page: number, pageSize: number): Promise<{ entries: EntrySummary[]; total: number }>;
}

const includeEntry = { supplier: { select: { id: true, name: true } }, items: { include: { product: { select: { id: true, name: true, unit: true, stockMode: true } } }, orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] } };

function entryAuditSnapshot(entry: EntryWithItems) {
  return { ...entry, items: entry.items.map((item) => ({ ...item, quantity: item.quantity.toString(), unitCost: item.unitCost.toString() })) };
}

export class PrismaEntryRepository implements EntryRepository {
  constructor(private readonly auditService: AuditService) {}

  findActiveSupplier(id: string): Promise<Supplier | null> { return prisma.supplier.findFirst({ where: { id, status: 'ACTIVE' } }); }
  findActiveProducts(ids: string[]): Promise<Product[]> { return prisma.product.findMany({ where: { id: { in: ids }, status: 'ACTIVE' } }); }

  createDraft(data: EntryWriteData): Promise<EntryWithItems> {
    return prisma.$transaction(async (transaction) => {
      const entry = await transaction.entry.create({ data: { supplierId: data.supplierId || null, createdById: data.actorUserId, status: 'EM_ANDAMENTO', items: { create: data.items.map((item, position) => ({ position, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost, lotIdentifier: item.lotIdentifier || null, expirationDate: item.expirationDate ? new Date(`${item.expirationDate}T00:00:00.000Z`) : null })) } } });
      const result = await transaction.entry.findUniqueOrThrow({ where: { id: entry.id }, include: includeEntry });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'ENTRY_DRAFT_CREATED', after: entryAuditSnapshot(result), entity: 'Entry', entityId: result.id, ipAddress: data.ipAddress }, transaction);
      return result;
    });
  }

  updateDraft(id: string, data: EntryWriteData): Promise<EntryWithItems | null> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.entry.findUnique({ where: { id }, include: includeEntry });
      if (!before) return null;
      const changed = await transaction.entry.updateMany({ where: { id, status: 'EM_ANDAMENTO' }, data: { supplierId: data.supplierId || null } });
      if (changed.count === 0) return null;
      await transaction.entryItem.deleteMany({ where: { entryId: id } });
      await transaction.entryItem.createMany({ data: data.items.map((item, position) => ({ entryId: id, position, productId: item.productId, quantity: item.quantity, unitCost: item.unitCost, lotIdentifier: item.lotIdentifier || null, expirationDate: item.expirationDate ? new Date(`${item.expirationDate}T00:00:00.000Z`) : null })) });
      const result = await transaction.entry.findUniqueOrThrow({ where: { id }, include: includeEntry });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'ENTRY_DRAFT_UPDATED', before: entryAuditSnapshot(before), after: entryAuditSnapshot(result), entity: 'Entry', entityId: id, ipAddress: data.ipAddress }, transaction);
      return result;
    });
  }

  findById(id: string): Promise<EntryWithItems | null> { return prisma.entry.findUnique({ where: { id }, include: includeEntry }); }

  async list(page: number, pageSize: number): Promise<{ entries: EntrySummary[]; total: number }> {
    const where: Prisma.EntryWhereInput = { status: 'EM_ANDAMENTO' as EntryStatus };
    const [entries, total] = await prisma.$transaction([
      prisma.entry.findMany({ where, include: { supplier: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.entry.count({ where }),
    ]);
    return { entries, total };
  }
}
