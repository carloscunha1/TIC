import { Prisma, type StockMovementType } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { recordStockMovementSchema, type RecordStockMovementInput } from './stock.schemas.js';
import type { StockMovementRepository, StockMovementDirection } from './stock.repository.js';

const movementDirections: Record<StockMovementType, StockMovementDirection> = {
  ENTRY: 'IN',
  EXIT: 'OUT',
  ADJUSTMENT_IN: 'IN',
  ADJUSTMENT_OUT: 'OUT',
  LOSS: 'OUT',
  RETURN_IN: 'IN',
  RETURN_OUT: 'OUT',
  REVERSAL_IN: 'IN',
  REVERSAL_OUT: 'OUT',
};

const correctiveMovementTypes = new Set<StockMovementType>(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS', 'RETURN_IN', 'RETURN_OUT', 'REVERSAL_IN', 'REVERSAL_OUT']);

export class StockService {
  constructor(private readonly repository: StockMovementRepository) {}

  async record(input: RecordStockMovementInput, actorUserId: string) {
    const data = recordStockMovementSchema.parse(input);
    const quantity = new Prisma.Decimal(data.quantity);
    if (quantity.decimalPlaces() > 3) throw new ApiError(400, 'INVALID_QUANTITY_PRECISION', 'A quantidade aceita no máximo três casas decimais.');

    try {
      return await this.repository.transaction(async (transaction) => {
        const product = await transaction.lockProduct(data.productId);
        if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
        if (product.stockMode !== 'SIMPLES') throw new ApiError(409, 'STOCK_MODE_NOT_SUPPORTED', 'Movimentações de produtos por lote serão disponibilizadas no módulo de lotes.');
        if (product.status === 'INACTIVE' && !correctiveMovementTypes.has(data.type)) throw new ApiError(409, 'PRODUCT_INACTIVE', 'Produtos inativos não podem receber novas entradas ou saídas comuns.');
        if (product.unit === 'UN' && !quantity.isInteger()) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');

        const balance = await transaction.changeBalance(product.id, movementDirections[data.type], quantity);
        const movement = await transaction.createMovement({ productId: product.id, type: data.type, quantity, reason: data.reason, observations: data.observations || undefined, actorUserId });
        return { movement, balance: balance.quantity.toString() };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') throw new ApiError(409, 'INSUFFICIENT_STOCK', 'A movimentação excede o saldo disponível.');
      if (error instanceof Error && error.message === 'STOCK_BALANCE_NOT_FOUND') throw new ApiError(409, 'STOCK_BALANCE_NOT_FOUND', 'O saldo do produto não foi inicializado.');
      throw error;
    }
  }
}
