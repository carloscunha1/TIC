import { Prisma, type Customer, type Product } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';
import type { SaleDraftInput, SaleItemInput, SaleUpdateInput } from './sale.schemas.js';

export type SaleWriteData = Omit<SaleDraftInput, 'items'> & {
  items: Array<SaleItemInput & { unitPrice: number }>;
  actorUserId: string;
  ipAddress?: string;
};
export type SaleUpdateData = SaleUpdateInput & { actorUserId: string; ipAddress?: string };
export type SaleWithItems = Prisma.SaleGetPayload<{ include: { customer: { select: { id: true; name: true; phone: true } }; operator: { select: { id: true; name: true } }; items: { include: { product: { select: { id: true; name: true; sku: true; unit: true } } } } } }>;
export type SaleSummary = Prisma.SaleGetPayload<{ include: { customer: { select: { name: true } }; operator: { select: { name: true } }; _count: { select: { items: true } } } }>;
export type SaleConfirmationData = { paymentMethod: 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' | 'OTHER' | 'LOYALTY'; loyaltyPoints?: number; idempotencyKey: string; idempotencyFingerprint: string; actorUserId: string; ipAddress?: string };

export interface SaleRepository {
  findActiveCustomer(id: string): Promise<Customer | null>;
  findActiveProducts(ids: string[]): Promise<Product[]>;
  findActiveProduct(id: string): Promise<Product | null>;
  createDraft(data: SaleWriteData): Promise<SaleWithItems>;
  updateDraft(id: string, data: SaleUpdateData): Promise<SaleWithItems | null>;
  addItem(id: string, item: SaleItemInput & { actorUserId: string; ipAddress?: string }): Promise<SaleWithItems | null>;
  updateItem(id: string, itemId: string, quantity: number, actorUserId: string, ipAddress?: string): Promise<SaleWithItems | null>;
  removeItem(id: string, itemId: string, actorUserId: string, ipAddress?: string): Promise<SaleWithItems | null>;
  findById(id: string): Promise<SaleWithItems | null>;
  list(page: number, pageSize: number): Promise<{ sales: SaleSummary[]; total: number }>;
  confirm(id: string, data: SaleConfirmationData): Promise<SaleWithItems>;
}
export interface SaleConfirmationRepository {
  confirm(id: string, data: SaleConfirmationData): Promise<SaleWithItems>;
}

export const includeSale = {
  customer: { select: { id: true, name: true, phone: true } },
  operator: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
};

function snapshot(sale: SaleWithItems) {
  return {
    ...sale,
    total: sale.total.toString(),
    items: sale.items.map((item) => ({ ...item, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), total: item.total.toString() })),
  };
}

export class PrismaSaleRepository implements SaleRepository {
  constructor(private readonly auditService: AuditService, private readonly confirmationRepository: SaleConfirmationRepository = { confirm: async () => { throw new Error('SALE_CONFIRMATION_NOT_CONFIGURED'); } }) {}

  findActiveCustomer(id: string): Promise<Customer | null> {
    return prisma.customer.findFirst({ where: { id, status: 'ACTIVE' } });
  }

  findActiveProducts(ids: string[]): Promise<Product[]> {
    return prisma.product.findMany({ where: { id: { in: ids }, status: 'ACTIVE' } });
  }

  findActiveProduct(id: string): Promise<Product | null> {
    return prisma.product.findFirst({ where: { id, status: 'ACTIVE' } });
  }

  createDraft(data: SaleWriteData): Promise<SaleWithItems> {
    return prisma.$transaction(async (transaction) => {
      const items = data.items.map((item) => {
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const total = unitPrice.mul(item.quantity);
        return { productId: item.productId, quantity: item.quantity, unitPrice, total };
      });
      const sale = await transaction.sale.create({
        data: {
          operatorUserId: data.actorUserId,
          customerId: data.customerId || null,
          observations: data.observations || null,
          total: items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0)),
          items: { create: items },
        },
      });
      const result = await transaction.sale.findUniqueOrThrow({ where: { id: sale.id }, include: includeSale });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SALE_DRAFT_CREATED', after: snapshot(result), entity: 'Sale', entityId: result.id, ipAddress: data.ipAddress }, transaction);
      return result;
    });
  }

  updateDraft(id: string, data: SaleUpdateData): Promise<SaleWithItems | null> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.sale.findUnique({ where: { id }, include: includeSale });
      if (!before) return null;
      const changed = await transaction.sale.updateMany({ where: { id, status: 'EM_ANDAMENTO' }, data: { customerId: data.customerId || null, observations: data.observations || null } });
      if (!changed.count) return null;
      const result = await transaction.sale.findUniqueOrThrow({ where: { id }, include: includeSale });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SALE_DRAFT_UPDATED', before: snapshot(before), after: snapshot(result), entity: 'Sale', entityId: id, ipAddress: data.ipAddress }, transaction);
      return result;
    });
  }

  addItem(id: string, data: SaleItemInput & { actorUserId: string; ipAddress?: string }): Promise<SaleWithItems | null> {
    return prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findFirst({ where: { id, status: 'EM_ANDAMENTO' }, include: includeSale });
      if (!sale) return null;
      const product = await transaction.product.findFirst({ where: { id: data.productId, status: 'ACTIVE' } });
      if (!product) return null;
      await transaction.saleItem.create({ data: { saleId: id, productId: product.id, quantity: data.quantity, unitPrice: product.salePrice, total: new Prisma.Decimal(data.quantity).mul(product.salePrice) } });
      const result = await this.recalculate(transaction, id);
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SALE_ITEM_ADDED', before: snapshot(sale), after: snapshot(result), entity: 'Sale', entityId: id, ipAddress: data.ipAddress }, transaction);
      return result;
    });
  }

  updateItem(id: string, itemId: string, quantity: number, actorUserId: string, ipAddress?: string): Promise<SaleWithItems | null> {
    return prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findFirst({ where: { id, status: 'EM_ANDAMENTO' }, include: includeSale });
      if (!sale || !sale.items.some((item) => item.id === itemId)) return null;
      await transaction.saleItem.update({ where: { id: itemId }, data: { quantity, total: new Prisma.Decimal(quantity).mul(sale.items.find((item) => item.id === itemId)!.unitPrice) } });
      const result = await this.recalculate(transaction, id);
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'SALE_ITEM_UPDATED', before: snapshot(sale), after: snapshot(result), entity: 'Sale', entityId: id, ipAddress }, transaction);
      return result;
    });
  }

  removeItem(id: string, itemId: string, actorUserId: string, ipAddress?: string): Promise<SaleWithItems | null> {
    return prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findFirst({ where: { id, status: 'EM_ANDAMENTO' }, include: includeSale });
      if (!sale || !sale.items.some((item) => item.id === itemId)) return null;
      await transaction.saleItem.delete({ where: { id: itemId } });
      const result = await this.recalculate(transaction, id);
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'SALE_ITEM_REMOVED', before: snapshot(sale), after: snapshot(result), entity: 'Sale', entityId: id, ipAddress }, transaction);
      return result;
    });
  }

  private async recalculate(transaction: Prisma.TransactionClient, id: string): Promise<SaleWithItems> {
    const items = await transaction.saleItem.findMany({ where: { saleId: id } });
    const total = items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
    await transaction.sale.update({ where: { id }, data: { total } });
    return transaction.sale.findUniqueOrThrow({ where: { id }, include: includeSale });
  }

  findById(id: string): Promise<SaleWithItems | null> {
    return prisma.sale.findUnique({ where: { id }, include: includeSale });
  }

  confirm(id: string, data: SaleConfirmationData): Promise<SaleWithItems> {
    return this.confirmationRepository.confirm(id, data);
  }

  async list(page: number, pageSize: number): Promise<{ sales: SaleSummary[]; total: number }> {
    const where: Prisma.SaleWhereInput = {};
    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({ where, include: { customer: { select: { name: true } }, operator: { select: { name: true } }, _count: { select: { items: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.sale.count({ where }),
    ]);
    return { sales, total };
  }
}
