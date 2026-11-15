import { Prisma, type StockBalance, type StockMovement, type StockMovementType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { ApiError } from '../../shared/http/api-error.js';
import type { StockMovementDirection, StockMovementRepository, StockMovementUnitOfWork, StockMovementWrite } from './stock.repository.js';
import { StockService } from './stock.service.js';

const productId = '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c';
const actorUserId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';

class FakeStockRepository implements StockMovementRepository {
  balance: Prisma.Decimal;
  movements: StockMovementWrite[] = [];
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
  stockMode: 'SIMPLES' | 'LOTE' = 'SIMPLES';
  unit: 'UN' | 'KG' = 'UN';
  failMovementWrite = false;
  private tail: Promise<void> = Promise.resolve();

  constructor(balance: string) { this.balance = new Prisma.Decimal(balance); }

  async transaction<T>(operation: (unitOfWork: StockMovementUnitOfWork) => Promise<T>): Promise<T> {
    let release = () => {};
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const previousBalance = this.balance;
    const movementCount = this.movements.length;
    const unitOfWork: StockMovementUnitOfWork = {
      lockProduct: async () => ({ id: productId, status: this.status, stockMode: this.stockMode, unit: this.unit }),
      changeBalance: async (_id, direction: StockMovementDirection, quantity) => {
        if (direction === 'OUT' && this.balance.lessThan(quantity)) throw new Error('INSUFFICIENT_STOCK');
        this.balance = direction === 'IN' ? this.balance.plus(quantity) : this.balance.minus(quantity);
        return { quantity: this.balance } as StockBalance;
      },
      createMovement: async (data) => {
        if (this.failMovementWrite) throw new Error('MOVEMENT_WRITE_FAILED');
        this.movements.push(data);
        return data as StockMovement;
      },
    };
    try {
      return await operation(unitOfWork);
    } catch (error) {
      this.balance = previousBalance;
      this.movements.length = movementCount;
      throw error;
    } finally {
      release();
    }
  }
}

function movement(type: StockMovementType, quantity: number) {
  return { productId, type, quantity, reason: 'Teste da operação' };
}

describe('StockService.record', () => {
  it('updates balance and records a movement within one transaction', async () => {
    const repository = new FakeStockRepository('10.000');
    repository.unit = 'KG';
    const result = await new StockService(repository).record(movement('ENTRY', 2.5), actorUserId);
    expect(result.balance).toBe('12.5');
    expect(repository.movements).toHaveLength(1);
    expect(repository.movements[0]).toMatchObject({ type: 'ENTRY', actorUserId });
  });

  it('rolls back the balance when saving the movement fails', async () => {
    const repository = new FakeStockRepository('10.000');
    repository.failMovementWrite = true;
    await expect(new StockService(repository).record(movement('EXIT', 3), actorUserId)).rejects.toThrow('MOVEMENT_WRITE_FAILED');
    expect(repository.balance.toString()).toBe('10');
    expect(repository.movements).toHaveLength(0);
  });

  it('prevents two concurrent exits from making the balance negative', async () => {
    const repository = new FakeStockRepository('10.000');
    const service = new StockService(repository);
    const results = await Promise.allSettled([service.record(movement('EXIT', 6), actorUserId), service.record(movement('EXIT', 6), actorUserId)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.code === 'INSUFFICIENT_STOCK')).toHaveLength(1);
    expect(repository.balance.toString()).toBe('4');
    expect(repository.movements).toHaveLength(1);
  });

  it('rejects common movements for inactive products but permits corrective losses', async () => {
    const repository = new FakeStockRepository('5.000');
    repository.status = 'INACTIVE';
    const service = new StockService(repository);
    await expect(service.record(movement('EXIT', 1), actorUserId)).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE' });
    await expect(service.record(movement('LOSS', 1), actorUserId)).resolves.toMatchObject({ balance: '4' });
  });

  it('rejects fractional quantities for unit products and lot-mode products', async () => {
    const repository = new FakeStockRepository('5.000');
    const service = new StockService(repository);
    await expect(service.record(movement('ENTRY', 1.5), actorUserId)).rejects.toMatchObject({ code: 'INVALID_UNIT_QUANTITY' });
    repository.unit = 'KG';
    repository.stockMode = 'LOTE';
    await expect(service.record(movement('ENTRY', 1.5), actorUserId)).rejects.toMatchObject({ code: 'STOCK_MODE_NOT_SUPPORTED' });
  });
});
