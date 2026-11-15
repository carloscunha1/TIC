import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { predefinedLossReasons, stockLossSchema, type StockLossInput } from './stock-loss.schemas.js';
import type { StockLossRepository } from './stock-loss.repository.js';

export class StockLossService {
  constructor(private readonly repository: StockLossRepository) {}

  async record(input: StockLossInput, actorUserId: string, ipAddress?: string) {
    const data = stockLossSchema.parse(input);
    const quantity = new Prisma.Decimal(data.quantity);
    try {
      return await this.repository.transaction(async (work) => {
        const product = await work.lockProduct(data.productId);
        if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
        if (product.unit === 'UN' && !quantity.isInteger()) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');
        const builtin = predefinedLossReasons.find(({ id }) => id === data.reasonId);
        const custom = builtin ? null : await work.findActiveReason(data.reasonId);
        if (!builtin && !custom) throw new ApiError(400, 'INVALID_LOSS_REASON', 'Selecione um motivo de perda ativo.');
        let lotId: string | undefined;
        if (product.stockMode === 'SIMPLES') {
          if (data.lotId) throw new ApiError(400, 'LOT_NOT_ALLOWED', 'Produto de estoque simples não aceita lote.');
          const balance = await work.getBalance(product.id);
          if (!balance) throw new ApiError(409, 'STOCK_BALANCE_NOT_FOUND', 'O saldo do produto não foi inicializado.');
          if (balance.lessThan(quantity)) throw this.insufficient();
          await work.decrementBalance(product.id, quantity);
        } else {
          if (!data.lotId) throw new ApiError(400, 'LOT_REQUIRED', 'Selecione o lote da perda.');
          const lot = await work.getLot(product.id, data.lotId);
          if (!lot) throw new ApiError(404, 'LOT_NOT_FOUND', 'Lote não encontrado para este produto.');
          if (lot.currentQuantity.lessThan(quantity)) throw this.insufficient();
          lotId = lot.id;
          await work.decrementLot(lot.id, quantity);
        }
        const reason = builtin?.name ?? custom!.name;
        const movement = await work.createMovement({ productId: product.id, lotId, quantity, reason, reasonId: custom?.id, observations: data.observations, actorUserId });
        await work.audit({ actorUserId, ipAddress, productId: product.id, productName: product.name, reason, quantity: quantity.toString(), lotId, movementId: movement.id });
        return { movement, balance: product.stockMode === 'SIMPLES' ? (await work.getBalance(product.id))?.toString() ?? '0' : undefined };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') throw this.insufficient();
      throw error;
    }
  }
  private insufficient(): ApiError { return new ApiError(409, 'INSUFFICIENT_STOCK', 'A quantidade da perda excede o saldo do produto ou lote.'); }
}
