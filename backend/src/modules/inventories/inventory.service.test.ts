import { Prisma, type InventoryItem, type StockMovement } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { ApiError } from '../../shared/http/api-error.js';
import type { InventoryCountTarget, InventoryDetail, InventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';

const inventoryId = 'c3af6e4a-377d-4cde-ad5b-e0efcc9f448e';
const productId = '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c';
const actorId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';
const startedAt = new Date('2026-11-15T10:00:00.000Z');

function makeItem(id: string, lotId: string | null, snapshotQuantity: string, unit: 'UN' | 'KG' = 'UN'): InventoryItem & InventoryDetail['items'][number] {
  const time = new Date('2026-11-15T10:00:00.000Z');
  return {
    id, inventoryId, productId, lotId, snapshotQuantity: new Prisma.Decimal(snapshotQuantity), countedQuantity: null, countedAt: null, createdAt: time, updatedAt: time,
    product: { id: productId, sku: 'SKU-1', name: 'Produto', unit, stockMode: lotId ? 'LOTE' : 'SIMPLES' },
    lot: lotId ? { id: lotId, identifier: `L-${id}`, expirationDate: null } : null,
  } as InventoryItem & InventoryDetail['items'][number];
}

function makeDetail(items: InventoryDetail['items'], movements: StockMovement[] = []): InventoryDetail {
  return {
    id: inventoryId, type: 'COMPLETE', status: 'EM_ANDAMENTO', observations: null, startedAt,
    createdById: actorId, createdAt: startedAt, updatedAt: startedAt, createdBy: { id: actorId, name: 'Operador' }, items, movements,
  } as InventoryDetail;
}

class FakeInventoryRepository implements InventoryRepository {
  detail = makeDetail([makeItem('item-1', null, '10')]);
  targetStatus: InventoryCountTarget['status'] = 'EM_ANDAMENTO';
  unit: InventoryCountTarget['unit'] = 'UN';
  createdInput: unknown = undefined;
  countInput: unknown;
  async create(data: Parameters<InventoryRepository['create']>[0]) { this.createdInput = data; return this.detail; }
  async list() { return { inventories: [], total: 0 }; }
  async findById() { return this.detail; }
  async findCountTarget() { return { status: this.targetStatus, unit: this.unit }; }
  async recordCount(_inventoryId: string, _itemId: string, quantity: Prisma.Decimal) { this.countInput = quantity.toString(); return this.detail.items[0]!; }
  async submitForReview() { this.targetStatus = 'AGUARDANDO_CONFERENCIA'; }
  async confirm() { if (this.targetStatus !== 'AGUARDANDO_CONFERENCIA') throw new Error('INVENTORY_INVALID_STATE'); this.targetStatus = 'CONFIRMADO'; }
  async cancel() { if (this.targetStatus === 'CONFIRMADO' || this.targetStatus === 'CANCELADO') throw new Error('INVENTORY_INVALID_STATE'); this.targetStatus = 'CANCELADO'; }
}

describe('InventoryService', () => {
  it('creates complete and selected partial inventories', async () => {
    const repository = new FakeInventoryRepository();
    const service = new InventoryService(repository);
    await service.create({ type: 'COMPLETE' }, actorId);
    expect(repository.createdInput).toMatchObject({ type: 'COMPLETE' });
    await service.create({ type: 'PARTIAL', productIds: [productId], categoryIds: [] }, actorId);
    expect(repository.createdInput).toMatchObject({ type: 'PARTIAL', productIds: [productId] });
    await expect(service.create({ type: 'PARTIAL' }, actorId)).rejects.toThrow();
  });

  it('calculates expected quantity from movements after snapshot, separately per lot', async () => {
    const firstLot = '52d8e4ee-4e7e-4f1d-8f64-174b26ef931c';
    const secondLot = 'b34216df-29ac-41bd-8c56-6df4b619b8e7';
    const later = new Date('2026-11-15T10:01:00.000Z');
    const movement = (id: string, lotId: string, type: 'ENTRY' | 'EXIT', quantity: string) => ({ id, productId, lotId, type, quantity: new Prisma.Decimal(quantity), reason: 'Movimento', observations: null, actorUserId: actorId, stockLossReasonId: null, createdAt: later } as StockMovement);
    const repository = new FakeInventoryRepository();
    repository.detail = makeDetail([makeItem('item-1', firstLot, '5', 'KG'), makeItem('item-2', secondLot, '8', 'KG')], [movement('movement-1', firstLot, 'ENTRY', '2'), movement('movement-2', secondLot, 'EXIT', '3')]);

    const detail = await new InventoryService(repository).get(inventoryId);

    expect(detail.items.map((item) => item.expectedQuantity)).toEqual(['7', '5']);
    expect(detail.items.map((item) => item.snapshotQuantity)).toEqual(['5', '8']);
  });

  it('records zero counts and rejects fractional counts for unit products or closed inventories', async () => {
    const repository = new FakeInventoryRepository();
    const service = new InventoryService(repository);
    await service.recordCount(inventoryId, 'item-1', { countedQuantity: 0 }, actorId);
    expect(repository.countInput).toBe('0');
    await expect(service.recordCount(inventoryId, 'item-1', { countedQuantity: 1.5 }, actorId)).rejects.toMatchObject({ code: 'INVALID_UNIT_QUANTITY' });
    repository.targetStatus = 'CONFIRMADO';
    await expect(service.recordCount(inventoryId, 'item-1', { countedQuantity: 1 }, actorId)).rejects.toBeInstanceOf(ApiError);
  });

  it('moves inventory through review, confirmation and cancellation without permitting confirmed edits', async () => {
    const repository = new FakeInventoryRepository();
    const service = new InventoryService(repository);
    await service.submitForReview(inventoryId, actorId);
    expect(repository.targetStatus).toBe('AGUARDANDO_CONFERENCIA');
    await service.confirm(inventoryId, actorId);
    expect(repository.targetStatus).toBe('CONFIRMADO');
    await expect(service.cancel(inventoryId, actorId)).rejects.toMatchObject({ code: 'INVENTORY_INVALID_STATE' });
    await expect(service.recordCount(inventoryId, 'item-1', { countedQuantity: 1 }, actorId)).rejects.toBeInstanceOf(ApiError);
  });

  it('allows cancellation while inventory is open or awaiting review', async () => {
    const repository = new FakeInventoryRepository();
    const service = new InventoryService(repository);
    await service.cancel(inventoryId, actorId);
    expect(repository.targetStatus).toBe('CANCELADO');
  });
});
