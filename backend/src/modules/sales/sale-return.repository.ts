import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ApiError } from '../../shared/http/api-error.js';
import { PrismaLoyaltyRepository } from '../loyalty/loyalty.repository.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { includeSale, type SaleReturnData, type SaleWithItems } from './sale.repository.js';

export class PrismaSaleReturnRepository {
  private readonly loyalty = new LoyaltyService(new PrismaLoyaltyRepository());

  constructor(private readonly auditService: AuditService) {}

  return(id: string, data: SaleReturnData): Promise<SaleWithItems> {
    return prisma.$transaction(async (transaction) => {
      const byKey = await transaction.saleReturn.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: { sale: { include: includeSale }, items: true } });
      if (byKey) {
        if (byKey.saleId !== id || byKey.idempotencyFingerprint !== data.idempotencyFingerprint) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'A chave de idempotência já foi usada com dados diferentes.');
        return byKey.sale;
      }

      const sale = await transaction.sale.findUnique({ where: { id }, include: includeSale });
      if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
      if (sale.status !== 'CONFIRMADA' && sale.status !== 'PARCIALMENTE_DEVOLVIDA') throw new ApiError(409, 'SALE_NOT_RETURNABLE', 'Somente vendas confirmadas podem receber devolução.');
      const requested = new Map(data.items.map((item) => [item.saleItemId, item]));
      if (requested.size !== data.items.length) throw new ApiError(400, 'DUPLICATE_RETURN_ITEM', 'O mesmo item não pode ser informado mais de uma vez.');
      const activeReturns = await transaction.saleReturnItem.findMany({ where: { returnRecord: { saleId: id, status: 'CONFIRMADA' } } });
      const returnItems: Array<{ saleItemId: string; lotId: string | null; quantity: Prisma.Decimal; destination: 'COMERCIALIZAVEL' | 'PERDA' }> = [];
      let refundBase = new Prisma.Decimal(0);

      for (const item of sale.items) {
        const input = requested.get(item.id);
        if (!input) continue;
        const allocations = item.allocations.length > 0 ? item.allocations : [{ lotId: null, quantity: item.quantity }];
        let remaining = new Prisma.Decimal(input.quantity);
        for (const allocation of allocations) {
          const alreadyReturned = activeReturns.filter((candidate) => candidate.saleItemId === item.id && candidate.lotId === allocation.lotId).reduce((sum, candidate) => sum.add(candidate.quantity), new Prisma.Decimal(0));
          const available = new Prisma.Decimal(allocation.quantity).sub(alreadyReturned);
          if (available.lessThan(0)) throw new ApiError(409, 'RETURN_DATA_INCONSISTENT', 'A quantidade devolvida anteriormente é inválida.');
          const quantity = Prisma.Decimal.min(remaining, available);
          if (quantity.greaterThan(0)) {
            returnItems.push({ saleItemId: item.id, lotId: allocation.lotId, quantity, destination: input.destination });
            remaining = remaining.sub(quantity);
            refundBase = refundBase.add(new Prisma.Decimal(item.unitPrice).mul(quantity));
          }
        }
        if (remaining.greaterThan(0)) throw new ApiError(409, 'RETURN_QUANTITY_EXCEEDED', 'A quantidade excede o saldo ainda não devolvido.');
      }
      if (returnItems.length === 0) throw new ApiError(400, 'RETURN_REQUIRES_ITEM', 'Informe ao menos um item para devolução.');

      const refundAmount = sale.paymentMethod === 'LOYALTY' ? new Prisma.Decimal(0) : refundBase.toDecimalPlaces(2);
      const returnRecord = await transaction.saleReturn.create({
        data: {
          id: randomUUID(),
          saleId: id,
          idempotencyKey: data.idempotencyKey,
          idempotencyFingerprint: data.idempotencyFingerprint,
          refundAmount,
          refundPaymentMethod: sale.paymentMethod === 'LOYALTY' ? null : data.refundPaymentMethod,
          operatorUserId: data.actorUserId,
          items: { create: returnItems.map((item) => ({ id: randomUUID(), saleItemId: item.saleItemId, lotId: item.lotId, quantity: item.quantity, destination: item.destination })) },
        },
        include: { items: true },
      });

      for (const item of returnItems) {
        const saleItem = sale.items.find((candidate) => candidate.id === item.saleItemId)!;
        if (item.destination === 'COMERCIALIZAVEL') {
          if (item.lotId) await transaction.stockLot.update({ where: { id: item.lotId }, data: { currentQuantity: { increment: item.quantity } } });
          else await transaction.stockBalance.upsert({ where: { productId: saleItem.productId }, create: { productId: saleItem.productId, quantity: item.quantity }, update: { quantity: { increment: item.quantity } } });
          await transaction.stockMovement.create({ data: { productId: saleItem.productId, lotId: item.lotId, type: 'RETURN_IN', quantity: item.quantity, reason: 'SALE_RETURN', observations: `Devolução ${returnRecord.id}`, actorUserId: data.actorUserId } });
        } else {
          await transaction.stockMovement.create({ data: { productId: saleItem.productId, lotId: item.lotId, type: 'LOSS', quantity: item.quantity, reason: 'SALE_RETURN_LOSS', observations: `Perda na devolução ${returnRecord.id}`, actorUserId: data.actorUserId } });
        }
      }

      await this.reverseLoyalty(transaction, sale, refundBase, activeReturns, returnRecord.id, data.actorUserId);
      const activeAfter = [...activeReturns, ...returnItems.map((item) => ({ saleItemId: item.saleItemId, lotId: item.lotId, quantity: item.quantity }))];
      const status = sale.items.every((item) => {
        const returned = activeAfter.filter((candidate) => candidate.saleItemId === item.id).reduce((sum, candidate) => sum.add(candidate.quantity), new Prisma.Decimal(0));
        return returned.greaterThanOrEqualTo(item.quantity);
      }) ? 'DEVOLVIDA' : 'PARCIALMENTE_DEVOLVIDA';
      const updatedSale = await transaction.sale.update({ where: { id }, data: { status }, include: includeSale });
      await this.auditService.record({ actor: { type: 'USER', userId: data.actorUserId }, action: 'SALE_RETURN_CONFIRMED', before: { id, status: sale.status }, after: { id, status, returnId: returnRecord.id, refundAmount: refundAmount.toString() }, entity: 'SaleReturn', entityId: returnRecord.id, ipAddress: data.ipAddress }, transaction);
      return updatedSale;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'A chave de idempotência já foi usada.');
      throw error;
    });
  }

  cancelReturn(id: string, justification: string, actorUserId: string, ipAddress?: string): Promise<SaleWithItems> {
    return prisma.$transaction(async (transaction) => {
      const record = await transaction.saleReturn.findUnique({ where: { id }, include: { sale: { include: includeSale }, items: true } });
      if (!record) throw new ApiError(404, 'SALE_RETURN_NOT_FOUND', 'Devolução não encontrada.');
      if (record.status !== 'CONFIRMADA') throw new ApiError(409, 'SALE_RETURN_NOT_ACTIVE', 'A devolução já foi cancelada.');
      for (const item of record.items) {
        const saleItem = record.sale.items.find((candidate) => candidate.id === item.saleItemId)!;
        if (item.destination === 'COMERCIALIZAVEL') {
          if (item.lotId) {
            const result = await transaction.stockLot.updateMany({ where: { id: item.lotId, currentQuantity: { gte: item.quantity } }, data: { currentQuantity: { decrement: item.quantity } } });
            if (result.count !== 1) throw new ApiError(409, 'INSUFFICIENT_STOCK', 'O estoque não possui a quantidade disponível para compensar a devolução.');
          } else {
            const result = await transaction.stockBalance.updateMany({ where: { productId: saleItem.productId, quantity: { gte: item.quantity } }, data: { quantity: { decrement: item.quantity } } });
            if (result.count !== 1) throw new ApiError(409, 'INSUFFICIENT_STOCK', 'O estoque não possui a quantidade disponível para compensar a devolução.');
          }
          await transaction.stockMovement.create({ data: { productId: saleItem.productId, lotId: item.lotId, type: 'RETURN_OUT', quantity: item.quantity, reason: 'SALE_RETURN_CANCELLATION', observations: `Cancelamento da devolução ${id}`, actorUserId } });
        } else {
          await transaction.stockMovement.create({ data: { productId: saleItem.productId, lotId: item.lotId, type: 'REVERSAL_IN', quantity: item.quantity, reason: 'SALE_RETURN_LOSS_CANCELLATION', observations: `Cancelamento da devolução ${id}`, actorUserId } });
        }
      }
      await this.compensateLoyaltyCancellation(transaction, record.sale, record.items, actorUserId, id);
      await transaction.saleReturn.update({ where: { id }, data: { status: 'CANCELADA', cancellationJustification: justification, canceledByUserId: actorUserId, canceledAt: new Date() } });
      const active = await transaction.saleReturnItem.findMany({ where: { returnRecord: { saleId: record.saleId, status: 'CONFIRMADA' } } });
      const status = record.sale.items.every((item) => active.filter((candidate) => candidate.saleItemId === item.id).reduce((sum, candidate) => sum.add(candidate.quantity), new Prisma.Decimal(0)).greaterThanOrEqualTo(item.quantity)) ? 'DEVOLVIDA' : 'PARCIALMENTE_DEVOLVIDA';
      const sale = await transaction.sale.update({ where: { id: record.saleId }, data: { status }, include: includeSale });
      await this.auditService.record({ actor: { type: 'USER', userId: actorUserId }, action: 'SALE_RETURN_CANCELLED', before: { id, status: 'CONFIRMADA' }, after: { id, status: 'CANCELADA', saleStatus: sale.status, justification }, entity: 'SaleReturn', entityId: id, ipAddress }, transaction);
      return sale;
    });
  }

  private async compensateLoyaltyCancellation(transaction: Prisma.TransactionClient, sale: SaleWithItems, items: Array<{ saleItemId: string; quantity: Prisma.Decimal }>, actorUserId: string, returnId: string) {
    if (!sale.customerId) return;
    const returnedValue = items.reduce((sum, item) => {
      const saleItem = sale.items.find((candidate) => candidate.id === item.saleItemId);
      return saleItem ? sum.add(new Prisma.Decimal(saleItem.unitPrice).mul(item.quantity)) : sum;
    }, new Prisma.Decimal(0));
    if (returnedValue.isZero() || sale.total.isZero()) return;
    const reversal = await transaction.loyaltyMovement.findFirst({ where: { sourceId: returnId, type: 'REVERSAL' }, select: { pointsDelta: true } });
    const points = Math.abs(reversal?.pointsDelta ?? 0);
    if (points > 0) {
      await transaction.loyaltyMovement.create({
        data: {
          id: randomUUID(),
          customerId: sale.customerId,
          type: 'COMPENSATION',
          pointsDelta: sale.paymentMethod === 'LOYALTY' ? -points : points,
          sourceType: 'SALE_RETURN_CANCELLATION',
          sourceId: returnId,
          reason: 'Compensação do cancelamento da devolução.',
          actorUserId,
        },
      });
    }
  }

  private async reverseLoyalty(transaction: Prisma.TransactionClient, sale: SaleWithItems, refundBase: Prisma.Decimal, activeReturns: Array<{ saleItemId: string; quantity: Prisma.Decimal }>, returnId: string, actorUserId: string) {
    if (!sale.customerId || refundBase.isZero()) return;
    const priorBase = activeReturns.reduce((sum, item) => {
      const saleItem = sale.items.find((candidate) => candidate.id === item.saleItemId);
      return saleItem ? sum.add(new Prisma.Decimal(saleItem.unitPrice).mul(item.quantity)) : sum;
    }, new Prisma.Decimal(0));
    if (sale.paymentMethod === 'LOYALTY') {
      const redemption = await transaction.loyaltyMovement.findUnique({ where: { sourceType_sourceId_type: { sourceType: 'SALE', sourceId: sale.id, type: 'REDEMPTION' } } });
      if (redemption) await this.loyalty.reverseRedemption({ customerId: sale.customerId, sourceType: 'SALE_RETURN_REDEMPTION', sourceId: returnId, movementId: redemption.id, points: new Prisma.Decimal(sale.loyaltyPointsRedeemed ?? 0).mul(refundBase.add(priorBase)).div(sale.total).floor().toNumber() - new Prisma.Decimal(sale.loyaltyPointsRedeemed ?? 0).mul(priorBase).div(sale.total).floor().toNumber(), actorUserId }, transaction);
      return;
    }
    const credit = await transaction.loyaltyCredit.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: sale.id } } });
    if (!credit) return;
    const points = Math.max(0, new Prisma.Decimal(credit.pointsGranted).mul(refundBase.add(priorBase)).div(sale.total).floor().toNumber() - new Prisma.Decimal(credit.pointsGranted).mul(priorBase).div(sale.total).floor().toNumber());
    if (points > 0) await this.loyalty.reverseAward({ customerId: sale.customerId, sourceType: 'SALE_RETURN_AWARD', sourceId: returnId, creditId: credit.id, points, actorUserId }, transaction);
  }
}
