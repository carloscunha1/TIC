import { Prisma, type Product, type StockLot, type StockMovement } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { ApiError } from '../../shared/http/api-error.js';
import type { StockExitProduct, StockExitRepository, StockExitUnitOfWork } from './stock-exit.repository.js';
import { StockExitService } from './stock-exit.service.js';

const productId = '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c';
const actorId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';

function makeLot(id: string, expirationDate: string | null, receivedAt: string, quantity: string): StockLot {
  return {
    id, productId, identifier: id, expirationDate: expirationDate ? new Date(`${expirationDate}T00:00:00.000Z`) : null,
    unitCost: new Prisma.Decimal('1.00'), initialQuantity: new Prisma.Decimal(quantity), currentQuantity: new Prisma.Decimal(quantity),
    receivedAt: new Date(receivedAt), createdAt: new Date(receivedAt), updatedAt: new Date(receivedAt),
  } as StockLot;
}

class FakeExitRepository implements StockExitRepository {
  stockMode: 'SIMPLES' | 'LOTE' = 'LOTE';
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
  unit: 'UN' | 'KG' = 'KG';
  simpleBalance = new Prisma.Decimal(0);
  lots: StockLot[] = [];
  movements: Array<{ productId: string; lotId?: string; quantity: Prisma.Decimal; reason: string; actorUserId: string }> = [];
  audits: unknown[] = [];
  failMovement = false;

  async transaction<T>(operation: (unit: StockExitUnitOfWork) => Promise<T>): Promise<T> {
    const previousSimple = this.simpleBalance;
    const previousLots = this.lots.map((lot) => ({ ...lot, currentQuantity: new Prisma.Decimal(lot.currentQuantity) }));
    const movementCount = this.movements.length;
    const auditCount = this.audits.length;
    const unit: StockExitUnitOfWork = {
      lockProduct: async () => ({ id: productId, name: 'Produto lote', unit: this.unit, stockMode: this.stockMode, status: this.status }) as StockExitProduct,
      getSimpleBalance: async () => this.simpleBalance,
      changeSimpleBalance: async (_id, quantity) => { this.simpleBalance = this.simpleBalance.minus(quantity); return this.simpleBalance; },
      getLots: async () => this.lots.filter((lot) => lot.currentQuantity.greaterThan(0)),
      changeLot: async (id, quantity) => { const lot = this.lots.find((item) => item.id === id); if (!lot || lot.currentQuantity.lessThan(quantity)) throw new Error('INSUFFICIENT_STOCK'); lot.currentQuantity = lot.currentQuantity.minus(quantity); },
      createMovement: async (data) => { if (this.failMovement) throw new Error('MOVEMENT_FAILED'); this.movements.push(data); return { id: `movement-${this.movements.length}`, ...data } as StockMovement; },
      audit: async (data) => { this.audits.push(data); },
    };
    try {
      return await operation(unit);
    } catch (error) {
      this.simpleBalance = previousSimple;
      this.lots = previousLots;
      this.movements.length = movementCount;
      this.audits.length = auditCount;
      throw error;
    }
  }
}

const input = (quantity: number) => ({ productId, quantity, reason: 'Saída operacional' });

describe('StockExitService.record', () => {
  it('allocates FEFO and uses FIFO for lots with the same expiration date', async () => {
    const repository = new FakeExitRepository();
    repository.lots = [
      makeLot('later-expiry', '2025-05-01', '2025-04-01T10:00:00.000Z', '5'),
      makeLot('expired', '2025-04-29', '2025-03-01T10:00:00.000Z', '3'),
      makeLot('same-day-later-received', '2025-04-30', '2025-04-02T10:00:00.000Z', '4'),
      makeLot('same-day-first-received', '2025-04-30', '2025-04-01T10:00:00.000Z', '2'),
      makeLot('no-expiration', null, '2025-01-01T10:00:00.000Z', '8'),
    ];
    const service = new StockExitService(repository, () => new Date('2025-04-30T22:30:00.000Z'));
    const result = await service.record(input(5), actorId);
    expect(result.movements.map((movement) => [movement.lotId, movement.quantity])).toEqual([
      ['same-day-first-received', '2'],
      ['same-day-later-received', '3'],
    ]);
    expect(repository.lots.find((lot) => lot.id === 'expired')?.currentQuantity.toString()).toBe('3');
    expect(result).toMatchObject({ physicalBalance: '17', availableBalance: '14' });
    expect(repository.audits).toHaveLength(1);
  });

  it('allows a lot through its expiration date and blocks it at the next local midnight', async () => {
    const onExpiry = new FakeExitRepository();
    onExpiry.lots = [makeLot('today', '2025-04-30', '2025-04-01T10:00:00.000Z', '2')];
    await expect(new StockExitService(onExpiry, () => new Date('2025-04-30T22:30:00.000Z')).record(input(1), actorId)).resolves.toMatchObject({ movements: [{ lotId: 'today' }] });

    const afterExpiry = new FakeExitRepository();
    afterExpiry.lots = [makeLot('yesterday', '2025-04-30', '2025-04-01T10:00:00.000Z', '2')];
    await expect(new StockExitService(afterExpiry, () => new Date('2025-05-01T03:00:00.000Z')).record(input(1), actorId)).rejects.toMatchObject({ code: 'INSUFFICIENT_AVAILABLE_STOCK' });
    expect(afterExpiry.lots[0]?.currentQuantity.toString()).toBe('2');
  });

  it('rejects an exit that exceeds available lot quantity without changing any lot', async () => {
    const repository = new FakeExitRepository();
    repository.lots = [makeLot('expired', '2025-04-29', '2025-03-01T10:00:00.000Z', '10'), makeLot('valid', '2025-05-01', '2025-04-01T10:00:00.000Z', '2')];
    await expect(new StockExitService(repository, () => new Date('2025-04-30T22:30:00.000Z')).record(input(3), actorId)).rejects.toMatchObject({ code: 'INSUFFICIENT_AVAILABLE_STOCK' });
    expect(repository.lots.map((lot) => lot.currentQuantity.toString())).toEqual(['10', '2']);
    expect(repository.movements).toHaveLength(0);
  });

  it('records simple-stock exits and prevents inactive products from common exits', async () => {
    const simple = new FakeExitRepository();
    simple.stockMode = 'SIMPLES';
    simple.simpleBalance = new Prisma.Decimal(4);
    const result = await new StockExitService(simple).record(input(2), actorId);
    expect(result).toMatchObject({ physicalBalance: '2', availableBalance: '2', movements: [{ lotId: null, quantity: '2' }] });

    simple.status = 'INACTIVE';
    await expect(new StockExitService(simple).record(input(1), actorId)).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE' });
  });

  it('rolls back lot changes if movement creation fails', async () => {
    const repository = new FakeExitRepository();
    repository.lots = [makeLot('lot-1', '2025-05-01', '2025-04-01T10:00:00.000Z', '2')];
    repository.failMovement = true;
    await expect(new StockExitService(repository, () => new Date('2025-04-30T22:30:00.000Z')).record(input(1), actorId)).rejects.toThrow('MOVEMENT_FAILED');
    expect(repository.lots[0]?.currentQuantity.toString()).toBe('2');
    expect(repository.movements).toHaveLength(0);
  });

  it('rejects fractional quantities for unit products', async () => {
    const repository = new FakeExitRepository();
    repository.unit = 'UN';
    repository.lots = [makeLot('lot-1', '2025-05-01', '2025-04-01T10:00:00.000Z', '2')];
    await expect(new StockExitService(repository, () => new Date('2025-04-30T22:30:00.000Z')).record(input(0.5), actorId)).rejects.toMatchObject({ code: 'INVALID_UNIT_QUANTITY' });
  });
});
