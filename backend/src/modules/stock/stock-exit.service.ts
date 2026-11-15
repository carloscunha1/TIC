import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { stockExitSchema, type StockExitInput } from './stock.schemas.js';
import type { StockExitRepository, StockExitUnitOfWork } from './stock-exit.repository.js';

type LotSnapshot = Awaited<ReturnType<StockExitUnitOfWork['getLots']>>[number];

function saoPauloToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

function sortFefoFifo(lots: LotSnapshot[]): LotSnapshot[] {
  return [...lots].sort((left, right) => {
    if (!left.expirationDate && right.expirationDate) return 1;
    if (left.expirationDate && !right.expirationDate) return -1;
    if (left.expirationDate && right.expirationDate) {
      const expirationOrder = left.expirationDate.getTime() - right.expirationDate.getTime();
      if (expirationOrder !== 0) return expirationOrder;
    }
    return left.receivedAt.getTime() - right.receivedAt.getTime() || left.id.localeCompare(right.id);
  });
}

function isUnexpired(expirationDate: Date | null, today: Date): boolean {
  return expirationDate === null || expirationDate.getTime() >= today.getTime();
}

export class StockExitService {
  constructor(private readonly repository: StockExitRepository, private readonly clock: () => Date = () => new Date()) {}

  async record(input: StockExitInput, actorUserId: string, ipAddress?: string) {
    const data = stockExitSchema.parse(input);
    const quantity = new Prisma.Decimal(data.quantity);
    const today = saoPauloToday(this.clock());

    try {
      return await this.repository.transaction(async (transaction) => {
        const product = await transaction.lockProduct(data.productId);
        if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
        if (product.status !== 'ACTIVE') throw new ApiError(409, 'PRODUCT_INACTIVE', 'Produtos inativos não podem ter saídas comuns.');
        if (product.unit === 'UN' && !quantity.isInteger()) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');

        const allocations: Array<{ lotId?: string; quantity: Prisma.Decimal }> = [];
        const lotById = new Map<string, LotSnapshot>();
        let physicalBefore: Prisma.Decimal;
        let availableBefore: Prisma.Decimal;

        if (product.stockMode === 'SIMPLES') {
          const balance = await transaction.getSimpleBalance(product.id);
          if (!balance) throw new ApiError(409, 'STOCK_BALANCE_NOT_FOUND', 'O saldo do produto não foi inicializado.');
          physicalBefore = balance;
          availableBefore = balance;
          if (balance.lessThan(quantity)) throw this.insufficientStock(balance);
          allocations.push({ quantity });
        } else {
          const lots = sortFefoFifo(await transaction.getLots(product.id));
          for (const lot of lots) lotById.set(lot.id, lot);
          physicalBefore = lots.reduce((sum, lot) => sum.plus(lot.currentQuantity), new Prisma.Decimal(0));
          const eligible = lots.filter((lot) => isUnexpired(lot.expirationDate, today));
          availableBefore = eligible.reduce((sum, lot) => sum.plus(lot.currentQuantity), new Prisma.Decimal(0));
          let remaining = quantity;
          for (const lot of eligible) {
            if (remaining.isZero()) break;
            const allocated = Prisma.Decimal.min(remaining, lot.currentQuantity);
            if (allocated.greaterThan(0)) allocations.push({ lotId: lot.id, quantity: allocated });
            remaining = remaining.minus(allocated);
          }
          if (remaining.greaterThan(0)) throw this.insufficientStock(availableBefore);
        }

        const movements: Array<{ id: string; lotId: string | null; lotIdentifier: string | null; quantity: string }> = [];
        for (const allocation of allocations) {
          if (allocation.lotId) await transaction.changeLot(allocation.lotId, allocation.quantity);
          else await transaction.changeSimpleBalance(product.id, allocation.quantity);
          const movement = await transaction.createMovement({ productId: product.id, ...(allocation.lotId ? { lotId: allocation.lotId } : {}), quantity: allocation.quantity, reason: data.reason, actorUserId });
          movements.push({ id: movement.id, lotId: allocation.lotId ?? null, lotIdentifier: allocation.lotId ? lotById.get(allocation.lotId)?.identifier ?? null : null, quantity: allocation.quantity.toString() });
        }

        const physicalAfter = physicalBefore.minus(quantity);
        const availableAfter = availableBefore.minus(quantity);
        await transaction.audit({ actorUserId, ipAddress, productId: product.id, productName: product.name, reason: data.reason, quantity: quantity.toString(), physicalBefore: physicalBefore.toString(), physicalAfter: physicalAfter.toString(), availableBefore: availableBefore.toString(), availableAfter: availableAfter.toString(), movements });
        return { movements, physicalBalance: physicalAfter.toString(), availableBalance: availableAfter.toString() };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STOCK') throw this.insufficientStock();
      throw error;
    }
  }

  private insufficientStock(available?: Prisma.Decimal): ApiError {
    return new ApiError(409, 'INSUFFICIENT_AVAILABLE_STOCK', 'A saída excede o estoque disponível para este produto.', available ? { availableBalance: available.toString() } : {});
  }
}
