import { Prisma, type StockBalance, type StockLot, type StockMovement } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import type { ConfirmationEntry, ConfirmationProduct, EntryConfirmationRepository, EntryConfirmationUnitOfWork } from './entry-confirmation.repository.js';
import { EntryConfirmationService } from './entry.confirmation.service.js';

const entryId = '1b85f90f-164b-41f0-9825-b9006b436b29';
const actorId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';
const supplierId = 'a0b1b953-1964-4fc6-a730-8c5895ae0e22';
const simpleProductId = '45b53188-613a-4a8e-a529-111111111111';
const lotProductId = '45b53188-613a-4a8e-a529-222222222222';

type FakeLot = { id: string; productId: string; identifier: string; expirationDate: Date | null; unitCost: Prisma.Decimal; initialQuantity: Prisma.Decimal; currentQuantity: Prisma.Decimal };

class FakeEntryConfirmationRepository implements EntryConfirmationRepository {
  entry: ConfirmationEntry;
  supplierStatus: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
  products = new Map<string, ConfirmationProduct>();
  balances = new Map<string, Prisma.Decimal>();
  lots: FakeLot[] = [];
  movements: Array<{ productId: string; lotId?: string; quantity: Prisma.Decimal; actorUserId: string; reason: string }> = [];
  costHistory: Array<{ productId: string; previous: Prisma.Decimal; next: Prisma.Decimal; actorUserId: string; entryId: string }> = [];
  audits: unknown[] = [];
  failMovement = false;
  private tail: Promise<void> = Promise.resolve();

  constructor(options: { mode?: 'SIMPLES' | 'LOTE'; status?: 'ACTIVE' | 'INACTIVE'; quantity?: string; unit?: 'UN' | 'KG'; supplierStatus?: 'ACTIVE' | 'INACTIVE' } = {}) {
    const mode = options.mode ?? 'SIMPLES';
    const productId = mode === 'LOTE' ? lotProductId : simpleProductId;
    this.supplierStatus = options.supplierStatus ?? 'ACTIVE';
    const product: ConfirmationProduct = { id: productId, name: 'Produto de teste', unit: options.unit ?? (mode === 'LOTE' ? 'KG' : 'UN'), stockMode: mode, status: options.status ?? 'ACTIVE', cost: new Prisma.Decimal('1.00') };
    this.products.set(productId, product);
    this.balances.set(productId, new Prisma.Decimal(options.quantity ?? '0'));
    const item = { id: 'entry-item-1', entryId, productId, position: 0, quantity: new Prisma.Decimal(mode === 'LOTE' ? '2.500' : '3'), unitCost: new Prisma.Decimal('2.50'), lotIdentifier: mode === 'LOTE' ? 'BATCH-1' : null, expirationDate: mode === 'LOTE' ? new Date('2027-02-01T00:00:00.000Z') : null, product };
    this.entry = { id: entryId, status: 'EM_ANDAMENTO', supplierId, supplier: { id: supplierId, status: this.supplierStatus }, items: [item] } as unknown as ConfirmationEntry;
  }

  async transaction<T>(operation: (unitOfWork: EntryConfirmationUnitOfWork) => Promise<T>): Promise<T> {
    let release = () => {};
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const snapshot = {
      entry: this.entry,
      balances: new Map([...this.balances].map(([key, value]) => [key, new Prisma.Decimal(value)])),
      lots: this.lots.map((lot) => ({ ...lot, unitCost: new Prisma.Decimal(lot.unitCost), initialQuantity: new Prisma.Decimal(lot.initialQuantity), currentQuantity: new Prisma.Decimal(lot.currentQuantity) })),
      movements: [...this.movements],
      costHistory: [...this.costHistory],
      audits: [...this.audits],
      productCosts: new Map([...this.products].map(([key, product]) => [key, new Prisma.Decimal(product.cost)])),
    };
    const unitOfWork: EntryConfirmationUnitOfWork = {
      lockEntry: async () => this.entry,
      lockSupplier: async () => ({ status: this.supplierStatus }),
      lockProducts: async (ids) => ids.map((id) => this.products.get(id)).filter((product): product is ConfirmationProduct => Boolean(product)),
      increaseSimpleBalance: async (productId, quantity) => {
        const next = (this.balances.get(productId) ?? new Prisma.Decimal(0)).plus(quantity);
        this.balances.set(productId, next);
        return { quantity: next } as StockBalance;
      },
      findLot: async ({ productId, identifier, expirationDate }) => this.lots.find((lot) => lot.productId === productId && lot.identifier === identifier && (lot.expirationDate?.getTime() ?? null) === (expirationDate?.getTime() ?? null)) as StockLot | undefined ?? null,
      createLot: async (data) => {
        const lot = { id: `lot-${this.lots.length + 1}`, ...data, initialQuantity: new Prisma.Decimal(data.quantity), currentQuantity: new Prisma.Decimal(data.quantity) };
        this.lots.push(lot);
        return lot as StockLot;
      },
      addToLot: async (lotId, quantity, unitCost) => {
        const lot = this.lots.find((item) => item.id === lotId);
        if (!lot) throw new Error('LOT_NOT_FOUND');
        lot.initialQuantity = lot.initialQuantity.plus(quantity);
        lot.currentQuantity = lot.currentQuantity.plus(quantity);
        lot.unitCost = unitCost;
        return lot as StockLot;
      },
      createMovement: async (data) => {
        if (this.failMovement) throw new Error('MOVEMENT_FAILED');
        this.movements.push(data);
        return data as StockMovement;
      },
      updateSimpleProductCost: async (productId, previous, next, changedBy, sourceId) => {
        const product = this.products.get(productId);
        if (!product) throw new Error('PRODUCT_NOT_FOUND');
        product.cost = next;
        if (!previous.equals(next)) this.costHistory.push({ productId, previous, next, actorUserId: changedBy, entryId: sourceId });
      },
      markConfirmed: async () => {
        if (this.entry.status !== 'EM_ANDAMENTO') return false;
        this.entry = { ...this.entry, status: 'CONFIRMADA' };
        return true;
      },
      findEntry: async () => this.entry as unknown as Awaited<ReturnType<EntryConfirmationUnitOfWork['findEntry']>>,
      audit: async (event) => { this.audits.push(event); },
    };

    try {
      return await operation(unitOfWork);
    } catch (error) {
      this.entry = snapshot.entry;
      this.balances = snapshot.balances;
      this.lots = snapshot.lots;
      this.movements = snapshot.movements;
      this.costHistory = snapshot.costHistory;
      this.audits = snapshot.audits;
      for (const [id, cost] of snapshot.productCosts) {
        const product = this.products.get(id);
        if (product) product.cost = cost;
      }
      throw error;
    } finally {
      release();
    }
  }
}

describe('EntryConfirmationService.confirm', () => {
  it('updates simple balance, movement, cost history, status and audit atomically', async () => {
    const repository = new FakeEntryConfirmationRepository({ quantity: '4.000' });
    const result = await new EntryConfirmationService(repository).confirm(entryId, actorId);
    expect(result).toMatchObject({ alreadyConfirmed: false, entry: { status: 'CONFIRMADA' } });
    expect(repository.balances.get(simpleProductId)?.toString()).toBe('7');
    expect(repository.movements).toHaveLength(1);
    expect(repository.movements[0]).toMatchObject({ productId: simpleProductId, actorUserId: actorId });
    expect(repository.costHistory).toHaveLength(1);
    expect(repository.audits).toHaveLength(1);
  });

  it('creates or reuses the matching lot and records movements linked to it', async () => {
    const repository = new FakeEntryConfirmationRepository({ mode: 'LOTE' });
    const service = new EntryConfirmationService(repository);
    await service.confirm(entryId, actorId);
    expect(repository.lots).toHaveLength(1);
    const firstLotId = repository.lots[0].id;
    expect(repository.movements[0]).toMatchObject({ productId: lotProductId, lotId: firstLotId });
    repository.entry = { ...repository.entry, status: 'EM_ANDAMENTO', items: repository.entry.items.map((item) => ({ ...item, unitCost: new Prisma.Decimal('2.75') })) };
    await service.confirm(entryId, actorId);
    expect(repository.lots).toHaveLength(1);
    expect(repository.lots[0].initialQuantity.toString()).toBe('5');
    expect(repository.lots[0].unitCost.toString()).toBe('2.75');
    expect(repository.movements).toHaveLength(2);
    expect(repository.movements[1].lotId).toBe(firstLotId);
  });

  it('is idempotent on repeated and concurrent confirmations', async () => {
    const repository = new FakeEntryConfirmationRepository();
    const service = new EntryConfirmationService(repository);
    const results = await Promise.all([service.confirm(entryId, actorId), service.confirm(entryId, actorId)]);
    expect(results.map((result) => result.alreadyConfirmed).sort()).toEqual([false, true]);
    expect(repository.movements).toHaveLength(1);
    expect(repository.balances.get(simpleProductId)?.toString()).toBe('3');
  });

  it('rolls back balances, movements and status if one write fails', async () => {
    const repository = new FakeEntryConfirmationRepository();
    repository.failMovement = true;
    await expect(new EntryConfirmationService(repository).confirm(entryId, actorId)).rejects.toThrow('MOVEMENT_FAILED');
    expect(repository.balances.get(simpleProductId)?.toString()).toBe('0');
    expect(repository.movements).toHaveLength(0);
    expect(repository.entry.status).toBe('EM_ANDAMENTO');
    expect(repository.audits).toHaveLength(0);
  });

  it('rolls back a newly created lot when movement creation fails', async () => {
    const repository = new FakeEntryConfirmationRepository({ mode: 'LOTE' });
    repository.failMovement = true;
    await expect(new EntryConfirmationService(repository).confirm(entryId, actorId)).rejects.toThrow('MOVEMENT_FAILED');
    expect(repository.lots).toHaveLength(0);
    expect(repository.movements).toHaveLength(0);
    expect(repository.entry.status).toBe('EM_ANDAMENTO');
  });

  it('rejects inactive supplier and inactive product before changing stock', async () => {
    const inactiveSupplier = new FakeEntryConfirmationRepository({ supplierStatus: 'INACTIVE' });
    await expect(new EntryConfirmationService(inactiveSupplier).confirm(entryId, actorId)).rejects.toMatchObject({ code: 'SUPPLIER_INACTIVE' });
    const inactiveProduct = new FakeEntryConfirmationRepository({ status: 'INACTIVE' });
    await expect(new EntryConfirmationService(inactiveProduct).confirm(entryId, actorId)).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE' });
    expect(inactiveProduct.balances.get(simpleProductId)?.toString()).toBe('0');
  });

  it('rejects confirmation for canceled entries', async () => {
    const repository = new FakeEntryConfirmationRepository();
    repository.entry = { ...repository.entry, status: 'CANCELADA' };
    await expect(new EntryConfirmationService(repository).confirm(entryId, actorId)).rejects.toMatchObject({ code: 'ENTRY_NOT_CONFIRMABLE' });
  });
});
