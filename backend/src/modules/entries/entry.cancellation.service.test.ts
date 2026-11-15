import { Prisma, type StockBalance, type StockLot, type StockMovement } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import type { CancellationEntry, EntryCancellationRepository, EntryCancellationUnitOfWork } from './entry-cancellation.repository.js';
import { EntryCancellationService } from './entry.cancellation.service.js';

const entryId = '1b85f90f-164b-41f0-9825-b9006b436b29';
const actorId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';
const simpleId = '45b53188-613a-4a8e-a529-111111111111';
const lotProductId = '45b53188-613a-4a8e-a529-222222222222';
const lotId = '45b53188-613a-4a8e-a529-333333333333';
const lotDate = new Date('2027-02-01T00:00:00.000Z');

class FakeCancellationRepository implements EntryCancellationRepository {
  entry: CancellationEntry;
  balance = new Prisma.Decimal(3);
  lot = { id: lotId, productId: lotProductId, identifier: 'BATCH-1', expirationDate: lotDate, unitCost: new Prisma.Decimal('2.50'), initialQuantity: new Prisma.Decimal('2.500'), currentQuantity: new Prisma.Decimal('2.500') };
  movements: Array<{ productId: string; lotId: string | null; type: string; quantity: Prisma.Decimal; reason: string; createdAt: Date; actorUserId?: string }>;
  reversals: Array<{ productId: string; lotId?: string; quantity: Prisma.Decimal; reason: string; actorUserId: string }> = [];
  audits: unknown[] = [];
  private failMark = false;

  constructor(mode: 'SIMPLES' | 'LOTE' = 'SIMPLES') {
    const item = mode === 'SIMPLES'
      ? { id: 'item-1', productId: simpleId, quantity: new Prisma.Decimal(3), lotIdentifier: null, expirationDate: null, product: { id: simpleId, name: 'Água', stockMode: mode } }
      : { id: 'item-1', productId: lotProductId, quantity: new Prisma.Decimal('2.500'), lotIdentifier: 'BATCH-1', expirationDate: lotDate, product: { id: lotProductId, name: 'Leite', stockMode: mode } };
    this.entry = { id: entryId, status: 'CONFIRMADA', items: [item] } as unknown as CancellationEntry;
    this.movements = [{ productId: item.productId, lotId: mode === 'LOTE' ? lotId : null, type: 'ENTRY', quantity: item.quantity, reason: `Confirmação da entrada ${entryId}`, createdAt: new Date('2026-11-15T10:00:00.000Z') }];
  }

  transaction<T>(operation: (unit: EntryCancellationUnitOfWork) => Promise<T>): Promise<T> {
    const unit: EntryCancellationUnitOfWork = {
      lockEntry: async () => this.entry,
      lockProducts: async () => {},
      getSimpleBalance: async () => ({ quantity: this.balance }) as StockBalance,
      changeSimpleBalance: async (_productId, quantity) => { this.balance = this.balance.minus(quantity); return { quantity: this.balance } as StockBalance; },
      getLot: async () => this.lot as StockLot,
      changeLot: async (_id, quantity) => { this.lot.currentQuantity = this.lot.currentQuantity.minus(quantity); this.lot.initialQuantity = this.lot.initialQuantity.minus(quantity); return this.lot as StockLot; },
      getEntryMovements: async () => this.movements as StockMovement[],
      getLotMovements: async (id) => this.movements.filter((movement) => movement.lotId === id) as StockMovement[],
      createReversal: async (data) => { this.reversals.push(data); return data as StockMovement; },
      markCanceled: async () => { if (this.failMark) return false; this.entry = { ...this.entry, status: 'CANCELADA' }; return true; },
      findEntry: async () => this.entry as unknown as Awaited<ReturnType<EntryCancellationUnitOfWork['findEntry']>>,
      audit: async (event) => { this.audits.push(event); },
    };
    return operation(unit);
  }
}

describe('EntryCancellationService.cancel', () => {
  it('cancels simple stock and writes a compensating movement and audit', async () => {
    const repository = new FakeCancellationRepository();
    const result = await new EntryCancellationService(repository).cancel(entryId, 'Lançamento duplicado', actorId);
    expect(result.entry.status).toBe('CANCELADA');
    expect(repository.balance.toString()).toBe('0');
    expect(repository.reversals[0]).toMatchObject({ productId: simpleId, quantity: new Prisma.Decimal(3), actorUserId: actorId });
    expect(repository.audits).toHaveLength(1);
  });

  it('cancels an intact lot and decreases both initial and current quantities', async () => {
    const repository = new FakeCancellationRepository('LOTE');
    await new EntryCancellationService(repository).cancel(entryId, 'Entrada duplicada', actorId);
    expect(repository.lot.initialQuantity.toString()).toBe('0');
    expect(repository.lot.currentQuantity.toString()).toBe('0');
    expect(repository.reversals[0]?.lotId).toBe(lotId);
  });

  it('blocks a lot that has been consumed or moved after receipt', async () => {
    const repository = new FakeCancellationRepository('LOTE');
    repository.lot.currentQuantity = new Prisma.Decimal('1.500');
    await expect(new EntryCancellationService(repository).cancel(entryId, 'Correção', actorId)).rejects.toMatchObject({ code: 'ENTRY_CANCELLATION_BLOCKED' });
    expect(repository.reversals).toHaveLength(0);
    expect(repository.entry.status).toBe('CONFIRMADA');
  });

  it('blocks insufficient simple balance without changing status or balance', async () => {
    const repository = new FakeCancellationRepository();
    repository.balance = new Prisma.Decimal(2);
    await expect(new EntryCancellationService(repository).cancel(entryId, 'Correção', actorId)).rejects.toMatchObject({ code: 'ENTRY_CANCELLATION_BLOCKED' });
    expect(repository.balance.toString()).toBe('2');
    expect(repository.reversals).toHaveLength(0);
  });

  it('rejects entries not confirmed', async () => {
    const repository = new FakeCancellationRepository();
    repository.entry = { ...repository.entry, status: 'EM_ANDAMENTO' };
    await expect(new EntryCancellationService(repository).cancel(entryId, 'Correção', actorId)).rejects.toMatchObject({ code: 'ENTRY_NOT_CANCELLABLE' });
  });
});
