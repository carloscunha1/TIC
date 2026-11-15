import { Prisma, type StockBalance, type StockMovement } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { ApiError } from '../../shared/http/api-error.js';
import type { StockAdjustmentProduct, StockAdjustmentRepository, StockAdjustmentUnitOfWork } from './stock-adjustment.repository.js';
import { StockAdjustmentService } from './stock-adjustment.service.js';

const productId = '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c';
const actorUserId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';

class FakeStockAdjustmentRepository implements StockAdjustmentRepository {
  balance: Prisma.Decimal;
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
  stockMode: 'SIMPLES' | 'LOTE' = 'SIMPLES';
  unit: 'UN' | 'KG' = 'UN';
  movements: Array<{ productId: string; type: string; quantity: Prisma.Decimal; justification: string; actorUserId: string }> = [];
  audits: unknown[] = [];
  failAudit = false;
  private tail: Promise<void> = Promise.resolve();

  constructor(balance: string) { this.balance = new Prisma.Decimal(balance); }

  async transaction<T>(operation: (unit: StockAdjustmentUnitOfWork) => Promise<T>): Promise<T> {
    let release = () => {};
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const previousBalance = this.balance;
    const movementCount = this.movements.length;
    const auditCount = this.audits.length;
    const unit: StockAdjustmentUnitOfWork = {
      lockProduct: async () => ({ id: productId, name: 'Produto teste', unit: this.unit, stockMode: this.stockMode, status: this.status }) as StockAdjustmentProduct,
      getBalance: async () => ({ quantity: this.balance }) as StockBalance,
      changeBalance: async (_id, direction, quantity) => {
        if (direction === 'NEGATIVE' && this.balance.lessThan(quantity)) throw new Error('INSUFFICIENT_STOCK');
        this.balance = direction === 'POSITIVE' ? this.balance.plus(quantity) : this.balance.minus(quantity);
        return { quantity: this.balance } as StockBalance;
      },
      createMovement: async (data) => { this.movements.push(data); return { id: 'movement-1', ...data } as StockMovement; },
      audit: async (data) => { if (this.failAudit) throw new Error('AUDIT_WRITE_FAILED'); this.audits.push(data); },
    };
    try {
      return await operation(unit);
    } catch (error) {
      this.balance = previousBalance;
      this.movements.length = movementCount;
      this.audits.length = auditCount;
      throw error;
    } finally {
      release();
    }
  }
}

function adjustment(direction: 'POSITIVE' | 'NEGATIVE', quantity: number) {
  return { productId, direction, quantity, justification: 'Contagem física corrigida' };
}

describe('StockAdjustmentService.record', () => {
  it('records a positive adjustment with a movement and audit', async () => {
    const repository = new FakeStockAdjustmentRepository('5');
    const result = await new StockAdjustmentService(repository).record(adjustment('POSITIVE', 3), actorUserId);
    expect(result.balance).toBe('8');
    expect(repository.movements[0]).toMatchObject({ type: 'ADJUSTMENT_IN', actorUserId, justification: 'Contagem física corrigida' });
    expect(repository.audits).toHaveLength(1);
  });

  it('records a valid negative adjustment as an adjustment, not a loss', async () => {
    const repository = new FakeStockAdjustmentRepository('5');
    const result = await new StockAdjustmentService(repository).record(adjustment('NEGATIVE', 2), actorUserId);
    expect(result.balance).toBe('3');
    expect(repository.movements[0]?.type).toBe('ADJUSTMENT_OUT');
    expect(repository.movements[0]?.type).not.toBe('LOSS');
  });

  it('blocks a negative adjustment above balance without changing data', async () => {
    const repository = new FakeStockAdjustmentRepository('2');
    await expect(new StockAdjustmentService(repository).record(adjustment('NEGATIVE', 3), actorUserId)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(repository.balance.toString()).toBe('2');
    expect(repository.movements).toHaveLength(0);
  });

  it('does not allow concurrent negative adjustments to overdraw the balance', async () => {
    const repository = new FakeStockAdjustmentRepository('5');
    const service = new StockAdjustmentService(repository);
    const results = await Promise.allSettled([service.record(adjustment('NEGATIVE', 4), actorUserId), service.record(adjustment('NEGATIVE', 4), actorUserId)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.code === 'INSUFFICIENT_STOCK')).toHaveLength(1);
    expect(repository.balance.toString()).toBe('1');
    expect(repository.movements).toHaveLength(1);
  });

  it('rejects fractional quantities for unit products and products using lots', async () => {
    const repository = new FakeStockAdjustmentRepository('2');
    await expect(new StockAdjustmentService(repository).record(adjustment('POSITIVE', 1.5), actorUserId)).rejects.toMatchObject({ code: 'INVALID_UNIT_QUANTITY' });
    repository.unit = 'KG';
    repository.stockMode = 'LOTE';
    await expect(new StockAdjustmentService(repository).record(adjustment('POSITIVE', 1.5), actorUserId)).rejects.toMatchObject({ code: 'STOCK_MODE_NOT_SUPPORTED' });
  });

  it('rolls back the balance and movement if audit fails', async () => {
    const repository = new FakeStockAdjustmentRepository('5');
    repository.failAudit = true;
    await expect(new StockAdjustmentService(repository).record(adjustment('POSITIVE', 1), actorUserId)).rejects.toThrow('AUDIT_WRITE_FAILED');
    expect(repository.balance.toString()).toBe('5');
    expect(repository.movements).toHaveLength(0);
  });

  it('allows corrective adjustments for inactive products', async () => {
    const repository = new FakeStockAdjustmentRepository('2');
    repository.status = 'INACTIVE';
    await expect(new StockAdjustmentService(repository).record(adjustment('POSITIVE', 1), actorUserId)).resolves.toMatchObject({ balance: '3' });
  });
});
