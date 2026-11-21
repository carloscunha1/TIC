import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { PrismaLoyaltyRepository } from '../loyalty/loyalty.repository.js';
import type { AuditService } from '../audit/audit.service.js';
import { includeSale, type SaleConfirmationData, type SaleRepository, type SaleWithItems } from './sale.repository.js';

type Allocation = { lotId?: string; quantity: Prisma.Decimal };
const saoPauloToday = (now: Date): Date => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return new Date(Date.UTC(Number(parts.find((part) => part.type === 'year')?.value), Number(parts.find((part) => part.type === 'month')?.value) - 1, Number(parts.find((part) => part.type === 'day')?.value)));
};

export class PrismaSaleConfirmationRepository implements Pick<SaleRepository, 'confirm'> {
  private readonly loyalty = new LoyaltyService(new PrismaLoyaltyRepository());

  constructor(private readonly auditService: AuditService) {}

  confirm(id: string, data: SaleConfirmationData): Promise<SaleWithItems> {
    return prisma.$transaction(async (transaction) => {
      const byKey = await transaction.sale.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: includeSale });
      if (byKey) {
        if (byKey.id !== id || byKey.idempotencyFingerprint !== data.idempotencyFingerprint) {
          throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'A chave de idempotência já foi usada com dados diferentes.');
        }
        return byKey;
      }

      const sale = await transaction.sale.findUnique({ where: { id }, include: includeSale });
      if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
      if (sale.status !== 'EM_ANDAMENTO') throw new ApiError(409, 'SALE_NOT_EDITABLE', 'Somente vendas em andamento podem ser confirmadas.');
      if (sale.items.length === 0) throw new ApiError(400, 'SALE_REQUIRES_ITEM', 'A venda deve possuir ao menos um item.');
      if (sale.customerId) {
        await transaction.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${sale.customerId}::uuid FOR UPDATE`;
        const customer = await transaction.customer.findFirst({ where: { id: sale.customerId, status: 'ACTIVE' }, select: { id: true } });
        if (!customer) throw new ApiError(409, 'CUSTOMER_INACTIVE', 'O cliente associado está inativo e não pode participar da venda.');
      }

      const itemAllocations = new Map<string, Allocation[]>();
      const orderedItems = [...sale.items].sort((left, right) => left.productId.localeCompare(right.productId) || left.id.localeCompare(right.id));
      for (const item of orderedItems) {
        const product = await this.lockProduct(transaction, item.productId);
        if (!product) throw new ApiError(409, 'PRODUCT_INACTIVE', 'Um produto da venda está inativo ou não existe.');
        const allocations = await this.allocate(transaction, product, item.quantity, saoPauloToday(new Date()));
        itemAllocations.set(item.id, allocations);
      }

      const totalCents = BigInt(sale.total.toFixed(2).replace('.', '')) * 1n;
      let redemptionValueCents = 0n;
      if (data.loyaltyPoints) {
        if (!sale.customerId) throw new ApiError(400, 'CUSTOMER_REQUIRED_FOR_LOYALTY', 'Associe um cliente para usar pontos.');
        const redemption = await this.loyalty.redeem({ customerId: sale.customerId, sourceType: 'SALE', sourceId: sale.id, points: data.loyaltyPoints, actorUserId: data.actorUserId }, transaction);
        redemptionValueCents = redemption.redemptionValueCents;
        if (data.paymentMethod === 'LOYALTY' && redemptionValueCents !== totalCents) {
          throw new ApiError(409, 'LOYALTY_TOTAL_MISMATCH', 'Os pontos devem pagar integralmente o total da venda.');
        }
      }
      if (data.paymentMethod === 'LOYALTY' && redemptionValueCents !== totalCents) {
        throw new ApiError(409, 'LOYALTY_TOTAL_MISMATCH', 'Os pontos devem pagar integralmente o total da venda.');
      }

      for (const item of sale.items) {
        for (const allocation of itemAllocations.get(item.id) ?? []) {
          if (allocation.lotId) {
            const result = await transaction.stockLot.updateMany({ where: { id: allocation.lotId, currentQuantity: { gte: allocation.quantity } }, data: { currentQuantity: { decrement: allocation.quantity } } });
            if (result.count !== 1) throw insufficientStock();
          } else {
            const result = await transaction.stockBalance.updateMany({ where: { productId: item.productId, quantity: { gte: allocation.quantity } }, data: { quantity: { decrement: allocation.quantity } } });
            if (result.count !== 1) throw insufficientStock();
          }
          await transaction.stockMovement.create({ data: { productId: item.productId, lotId: allocation.lotId, type: 'EXIT', quantity: allocation.quantity, reason: 'SALE_CONFIRMATION', observations: `Venda ${sale.id}`, actorUserId: data.actorUserId } });
          await transaction.saleItemAllocation.create({ data: { id: randomUUID(), saleItemId: item.id, lotId: allocation.lotId, quantity: allocation.quantity } });
        }
      }

      if (sale.customerId && data.paymentMethod !== 'LOYALTY') {
        await this.loyalty.award({ customerId: sale.customerId, sourceType: 'SALE', sourceId: sale.id, eligibleAmount: sale.total.toFixed(2), actorUserId: data.actorUserId }, transaction);
      }

      const confirmed = await transaction.sale.update({ where: { id }, data: { status: 'CONFIRMADA', paymentMethod: data.paymentMethod, loyaltyPointsRedeemed: data.loyaltyPoints ?? null, idempotencyKey: data.idempotencyKey, idempotencyFingerprint: data.idempotencyFingerprint, confirmedAt: new Date() }, include: includeSale });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SALE_CONFIRMED', before: { id: sale.id, status: sale.status, total: sale.total.toString() }, after: { id: confirmed.id, status: confirmed.status, paymentMethod: data.paymentMethod, loyaltyPoints: data.loyaltyPoints ?? 0, total: confirmed.total.toString() }, entity: 'Sale', entityId: id, ipAddress: data.ipAddress }, transaction);
      return confirmed;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'A chave de idempotência já foi usada.');
      throw error;
    });
  }

  private async lockProduct(transaction: Prisma.TransactionClient, productId: string) {
    await transaction.$queryRaw`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`;
    return transaction.product.findFirst({ where: { id: productId, status: 'ACTIVE' }, select: { id: true, unit: true, stockMode: true } });
  }

  private async allocate(transaction: Prisma.TransactionClient, product: { id: string; unit: string; stockMode: string }, quantity: Prisma.Decimal, today: Date): Promise<Allocation[]> {
    if (product.unit === 'UN' && !quantity.isInteger()) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');
    if (product.stockMode === 'SIMPLES') {
      const balance = await transaction.stockBalance.findUnique({ where: { productId: product.id }, select: { quantity: true } });
      if (!balance || balance.quantity.lessThan(quantity)) throw insufficientStock(balance?.quantity);
      return [{ quantity }];
    }
    const lots = await transaction.stockLot.findMany({ where: { productId: product.id, currentQuantity: { gt: 0 } }, orderBy: [{ expirationDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }, { id: 'asc' }] });
    const eligible = lots.filter((lot) => !lot.expirationDate || lot.expirationDate.getTime() >= today.getTime());
    const allocations: Allocation[] = [];
    let remaining = quantity;
    for (const lot of eligible) {
      if (remaining.isZero()) break;
      const allocated = Prisma.Decimal.min(remaining, lot.currentQuantity);
      if (allocated.greaterThan(0)) allocations.push({ lotId: lot.id, quantity: allocated });
      remaining = remaining.minus(allocated);
    }
    if (remaining.greaterThan(0)) throw insufficientStock(eligible.reduce((sum, lot) => sum.plus(lot.currentQuantity), new Prisma.Decimal(0)));
    return allocations;
  }
}

function insufficientStock(available?: Prisma.Decimal): ApiError {
  return new ApiError(409, 'INSUFFICIENT_AVAILABLE_STOCK', 'A venda excede o estoque disponível.', available ? { availableBalance: available.toString() } : {});
}
