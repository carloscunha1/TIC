import { Prisma, type StockLossReason, type StockLot, type StockMovement } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import type { StockLossRepository, StockLossUnitOfWork } from './stock-loss.repository.js';
import { StockLossService } from './stock-loss.service.js';

const productId = '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c';
const actorId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';
const lotId = '52d8e4ee-4e7e-4f1d-8f64-174b26ef931c';

class FakeLossRepository implements StockLossRepository {
  mode: 'SIMPLES' | 'LOTE' = 'SIMPLES';
  unit: 'UN' | 'KG' = 'UN';
  balance = new Prisma.Decimal(4);
  lotQuantity = new Prisma.Decimal(0);
  lotExpiration: Date | null = null;
  movements: Array<{ productId: string; lotId?: string; quantity: Prisma.Decimal; reason: string; reasonId?: string; observations?: string; actorUserId: string }> = [];
  audits: unknown[] = [];
  activeCustomReason: StockLossReason | null = null;

  async transaction<T>(operation: (work: StockLossUnitOfWork) => Promise<T>): Promise<T> {
    const previousBalance = this.balance;
    const previousLotQuantity = this.lotQuantity;
    const count = this.movements.length;
    const auditCount = this.audits.length;
    const work: StockLossUnitOfWork = {
      lockProduct: async () => ({ id: productId, name: 'Produto teste', unit: this.unit, stockMode: this.mode }),
      getBalance: async () => this.balance,
      getLot: async (product, id) => product === productId && id === lotId ? ({ id, productId, identifier: 'VENCIDO', expirationDate: this.lotExpiration, currentQuantity: this.lotQuantity } as StockLot) : null,
      decrementBalance: async (_id, quantity) => { if (this.balance.lessThan(quantity)) throw new Error('INSUFFICIENT_STOCK'); this.balance = this.balance.minus(quantity); },
      decrementLot: async (_id, quantity) => { if (this.lotQuantity.lessThan(quantity)) throw new Error('INSUFFICIENT_STOCK'); this.lotQuantity = this.lotQuantity.minus(quantity); },
      findActiveReason: async (id) => id === this.activeCustomReason?.id ? this.activeCustomReason : null,
      createMovement: async (data) => { this.movements.push(data); return { id: 'movement-1', type: 'LOSS', ...data } as StockMovement; },
      audit: async (data) => { this.audits.push(data); },
    };
    try { return await operation(work); } catch (error) { this.balance = previousBalance; this.lotQuantity = previousLotQuantity; this.movements.length = count; this.audits.length = auditCount; throw error; }
  }
}

describe('StockLossService.record', () => {
  it('records a distinct loss movement and updates simple balance', async () => {
    const repo = new FakeLossRepository();
    const result = await new StockLossService(repo).record({ productId, reasonId: 'DAMAGED', quantity: 2 }, actorId);
    expect(result).toMatchObject({ balance: '2', movement: { type: 'LOSS', reason: 'Danificado' } });
    expect(repo.movements).toHaveLength(1);
    expect(repo.audits).toHaveLength(1);
  });

  it('allows an expired lot loss and only reduces the selected lot', async () => {
    const repo = new FakeLossRepository();
    repo.mode = 'LOTE'; repo.unit = 'KG'; repo.lotQuantity = new Prisma.Decimal(3); repo.lotExpiration = new Date('2020-01-01T00:00:00.000Z');
    const result = await new StockLossService(repo).record({ productId, reasonId: 'EXPIRED', quantity: 1.5, lotId }, actorId);
    expect(result.movement).toMatchObject({ type: 'LOSS', lotId });
    expect(repo.lotQuantity.toString()).toBe('1.5');
  });

  it('rejects insufficient balance, invalid lot association and fractional units', async () => {
    const repo = new FakeLossRepository();
    await expect(new StockLossService(repo).record({ productId, reasonId: 'BROKEN', quantity: 5 }, actorId)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    repo.mode = 'LOTE';
    await expect(new StockLossService(repo).record({ productId, reasonId: 'EXPIRED', quantity: 1 }, actorId)).rejects.toMatchObject({ code: 'LOT_REQUIRED' });
    repo.mode = 'SIMPLES';
    await expect(new StockLossService(repo).record({ productId, reasonId: 'DAMAGED', quantity: 1.5 }, actorId)).rejects.toMatchObject({ code: 'INVALID_UNIT_QUANTITY' });
    expect(repo.movements).toHaveLength(0);
  });
});
