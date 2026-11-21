import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { ApiError } from '../../shared/http/api-error.js';
import { PrismaLoyaltyRepository } from '../loyalty/loyalty.repository.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import type { AuditService } from '../audit/audit.service.js';
import { includeSale, type SaleWithItems } from './sale.repository.js';
import type { SaleCancellationReason } from './sale.repository.js';

export type SaleCancellationData = {
  reason?: SaleCancellationReason;
  justification: string;
  actorUserId: string;
  ipAddress?: string;
};

export class PrismaSaleCancellationRepository {
  private readonly loyalty = new LoyaltyService(new PrismaLoyaltyRepository());

  constructor(private readonly auditService: AuditService) {}

  cancel(id: string, data: SaleCancellationData): Promise<SaleWithItems> {
    return prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findUnique({ where: { id }, include: includeSale });
      if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
      if (sale.status === 'EM_ANDAMENTO') {
        if (!data.reason || data.reason === 'EXPIRACAO_POR_INATIVIDADE') {
          throw new ApiError(400, 'SALE_CANCELLATION_REASON_REQUIRED', 'Informe um motivo válido para cancelar a venda em andamento.');
        }
        const canceled = await transaction.sale.update({
          where: { id },
          data: {
            status: 'CANCELADA',
            cancellationReason: data.reason,
            cancellationJustification: data.justification,
            canceledByUserId: data.actorUserId,
            canceledAt: new Date(),
          },
          include: includeSale,
        });
        await this.auditService.record({
          actor: { type: 'USER', userId: data.actorUserId },
          action: 'SALE_DRAFT_CANCELLED',
          before: { id: sale.id, status: sale.status },
          after: { id: canceled.id, status: canceled.status, reason: data.reason, justification: data.justification },
          entity: 'Sale',
          entityId: id,
          ipAddress: data.ipAddress,
        }, transaction);
        return canceled;
      }
      if (sale.status === 'PARCIALMENTE_DEVOLVIDA' || sale.status === 'DEVOLVIDA') {
        throw new ApiError(409, 'SALE_PARTIALLY_RETURNED', 'Não é possível cancelar uma venda que já possui devolução.');
      }
      if (sale.status !== 'CONFIRMADA') {
        throw new ApiError(409, 'SALE_NOT_CONFIRMED', 'Somente vendas confirmadas podem ser canceladas.');
      }
      if (!sale.customerId && sale.loyaltyPointsRedeemed) {
        throw new ApiError(409, 'SALE_LOYALTY_DATA_INVALID', 'A venda possui dados de fidelidade inconsistentes.');
      }

      for (const item of sale.items) {
        for (const allocation of item.allocations) {
          if (allocation.lotId) {
            await transaction.stockLot.update({ where: { id: allocation.lotId }, data: { currentQuantity: { increment: allocation.quantity } } });
          } else {
            await transaction.stockBalance.upsert({ where: { productId: item.productId }, create: { productId: item.productId, quantity: allocation.quantity }, update: { quantity: { increment: allocation.quantity } } });
          }
          await transaction.stockMovement.create({
            data: {
              productId: item.productId,
              lotId: allocation.lotId,
              type: 'RETURN_IN',
              quantity: allocation.quantity,
              reason: 'SALE_CANCELLATION',
              observations: `Cancelamento da venda ${sale.id}`,
              actorUserId: data.actorUserId,
            },
          });
        }
      }

      if (sale.customerId) {
        const credit = await transaction.loyaltyCredit.findUnique({ where: { sourceType_sourceId: { sourceType: 'SALE', sourceId: sale.id } } });
        if (credit) {
          await this.loyalty.reverseAward({
            customerId: sale.customerId,
            sourceType: 'SALE_CANCELLATION_AWARD',
            sourceId: sale.id,
            creditId: credit.id,
            actorUserId: data.actorUserId,
          }, transaction);
        }
        const redemption = await transaction.loyaltyMovement.findUnique({ where: { sourceType_sourceId_type: { sourceType: 'SALE', sourceId: sale.id, type: 'REDEMPTION' } } });
        if (redemption) {
          await this.loyalty.reverseRedemption({
            customerId: sale.customerId,
            sourceType: 'SALE_CANCELLATION_REDEMPTION',
            sourceId: sale.id,
            movementId: redemption.id,
            actorUserId: data.actorUserId,
          }, transaction);
        }
      }

      const refundAmount = sale.paymentMethod === 'LOYALTY' ? new Prisma.Decimal(0) : sale.total;
      const canceled = await transaction.sale.update({
        where: { id },
        data: {
          status: 'CANCELADA',
          cancellationReason: data.reason,
          cancellationJustification: data.justification,
          canceledByUserId: data.actorUserId,
          canceledAt: new Date(),
          refundAmount,
          refundPaymentMethod: sale.paymentMethod === 'LOYALTY' ? null : sale.paymentMethod,
          refundOperatorUserId: sale.paymentMethod === 'LOYALTY' ? null : data.actorUserId,
          refundRecordedAt: sale.paymentMethod === 'LOYALTY' ? null : new Date(),
        },
        include: includeSale,
      });
      await this.auditService.record({
        actor: { type: 'USER', userId: data.actorUserId },
        action: 'SALE_CANCELLED',
        before: { id: sale.id, status: sale.status, total: sale.total.toString() },
        after: { id: canceled.id, status: canceled.status, refundAmount: refundAmount.toString(), justification: data.justification },
        entity: 'Sale',
        entityId: id,
        ipAddress: data.ipAddress,
      }, transaction);
      return canceled;
    });
  }

  expireDrafts(now = new Date()): Promise<number> {
    const expiresBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return prisma.$transaction(async (transaction) => {
      const candidates = await transaction.sale.findMany({
        where: { status: 'EM_ANDAMENTO', updatedAt: { lt: expiresBefore } },
        select: { id: true, status: true },
      });
      let canceledCount = 0;
      for (const candidate of candidates) {
        const canceled = await transaction.sale.updateMany({
          where: { id: candidate.id, status: 'EM_ANDAMENTO', updatedAt: { lt: expiresBefore } },
          data: {
            status: 'CANCELADA',
            cancellationReason: 'EXPIRACAO_POR_INATIVIDADE',
            cancellationJustification: 'Venda cancelada automaticamente após 24 horas sem atividade.',
            canceledByUserId: null,
            canceledAt: now,
          },
        });
        if (!canceled.count) continue;
        canceledCount += 1;
        await this.auditService.record({
          actor: { type: 'SYSTEM' },
          action: 'SALE_DRAFT_EXPIRED',
          before: { id: candidate.id, status: candidate.status },
          after: { id: candidate.id, status: 'CANCELADA', reason: 'EXPIRACAO_POR_INATIVIDADE' },
          entity: 'Sale',
          entityId: candidate.id,
        }, transaction);
      }
      return canceledCount;
    });
  }
}
