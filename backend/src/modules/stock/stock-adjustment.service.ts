import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { stockAdjustmentSchema, type StockAdjustmentInput } from './stock-adjustment.schemas.js';
import type { StockAdjustmentRepository } from './stock-adjustment.repository.js';

export class StockAdjustmentService {
  constructor(private readonly repository: StockAdjustmentRepository) {}

  async record(input: StockAdjustmentInput, actorUserId: string, ipAddress?: string) {
    const data = stockAdjustmentSchema.parse(input);
    const quantity = new Prisma.Decimal(data.quantity);

    try {
      return await this.repository.transaction(async (transaction) => {
        const product = await transaction.lockProduct(data.productId);
        if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
        if (product.stockMode !== 'SIMPLES') throw new ApiError(409, 'STOCK_MODE_NOT_SUPPORTED', 'Ajustes desta tarefa são permitidos apenas para produtos de estoque simples.');
        if (product.unit === 'UN' && !quantity.isInteger()) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');

        const previousBalance = await transaction.getBalance(product.id);
        if (!previousBalance) throw new ApiError(409, 'STOCK_BALANCE_NOT_FOUND', 'O saldo do produto não foi inicializado.');
        if (data.direction === 'NEGATIVE' && previousBalance.quantity.lessThan(quantity)) {
          throw new ApiError(409, 'INSUFFICIENT_STOCK', `O ajuste excede o saldo atual de ${previousBalance.quantity.toString()}.`, { balance: previousBalance.quantity.toString() });
        }

        const type = data.direction === 'POSITIVE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        const balance = await transaction.changeBalance(product.id, data.direction, quantity);
        const movement = await transaction.createMovement({ productId: product.id, type, quantity, justification: data.justification, actorUserId });
        await transaction.audit({ actorUserId, ipAddress, productId: product.id, productName: product.name, previousBalance: previousBalance.quantity.toString(), nextBalance: balance.quantity.toString(), type, quantity: quantity.toString(), justification: data.justification, movementId: movement.id });
        return { movement, balance: balance.quantity.toString() };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') throw new ApiError(409, 'INSUFFICIENT_STOCK', 'O ajuste excede o saldo disponível.');
      throw error;
    }
  }
}
