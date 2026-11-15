import { describe, expect, it, jest } from '@jest/globals';
import type { Product, Supplier } from '@prisma/client';
import type { EntryRepository, EntryWithItems } from './entry.repository.js';
import type { EntryDraftInput } from './entry.schemas.js';
import { EntryService } from './entry.service.js';

const supplier = { id: 'a0b1b953-1964-4fc6-a730-8c5895ae0e22', status: 'ACTIVE' } as Supplier;
const simple = { id: '45b53188-613a-4a8e-a529-111111111111', status: 'ACTIVE', stockMode: 'SIMPLES', unit: 'UN' } as Product;
const lot = { id: '45b53188-613a-4a8e-a529-222222222222', status: 'ACTIVE', stockMode: 'LOTE', unit: 'KG' } as Product;
const entry = { id: '1b85f90f-164b-41f0-9825-b9006b436b29', status: 'EM_ANDAMENTO', items: [] } as unknown as EntryWithItems;

function repository(overrides: Partial<EntryRepository> = {}): EntryRepository {
  return {
    findActiveSupplier: jest.fn(async () => supplier),
    findActiveProducts: jest.fn(async (ids: string[]) => [simple, lot].filter((product) => ids.includes(product.id))),
    createDraft: jest.fn(async () => entry),
    updateDraft: jest.fn(async () => entry),
    findById: jest.fn(async () => entry),
    list: jest.fn(async () => ({ entries: [], total: 0 })),
    ...overrides,
  };
}

const draft: EntryDraftInput = { supplierId: supplier.id, items: [{ productId: simple.id, quantity: 2, unitCost: 1.25 }] };

describe('EntryService', () => {
  it('creates a draft without involving stock movements', async () => {
    const repo = repository();
    await expect(new EntryService(repo).create(draft, 'user-id')).resolves.toBe(entry);
    expect(repo.createDraft).toHaveBeenCalledWith(expect.objectContaining({ ...draft, actorUserId: 'user-id' }));
  });

  it('requires an active supplier and active products', async () => {
    await expect(new EntryService(repository({ findActiveSupplier: jest.fn(async () => null) })).create(draft, 'user-id')).rejects.toMatchObject({ code: 'SUPPLIER_INACTIVE_OR_NOT_FOUND' });
    await expect(new EntryService(repository({ findActiveProducts: jest.fn(async () => []) })).create(draft, 'user-id')).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE_OR_NOT_FOUND' });
  });

  it('requires lot identification for lot products and rejects lot data for simple products', async () => {
    const repo = repository();
    await expect(new EntryService(repo).create({ items: [{ productId: lot.id, quantity: 1.5, unitCost: 2 } ] }, 'user-id')).rejects.toMatchObject({ code: 'LOT_REQUIRED' });
    await expect(new EntryService(repo).create({ items: [{ productId: simple.id, quantity: 1, unitCost: 2, lotIdentifier: 'L-1' }] }, 'user-id')).rejects.toMatchObject({ code: 'LOT_NOT_ALLOWED' });
  });

  it('preserves multiple lines of one lot-tracked product for different lots', async () => {
    const repo = repository();
    const lines: EntryDraftInput = { items: [
      { productId: lot.id, quantity: 1.5, unitCost: 2, lotIdentifier: 'LOTE-A' },
      { productId: lot.id, quantity: 2.5, unitCost: 2.1, lotIdentifier: 'LOTE-B' },
    ] };
    await new EntryService(repo).create(lines, 'user-id');
    expect(repo.createDraft).toHaveBeenCalledWith(expect.objectContaining({ items: lines.items }));
  });

  it('rejects fractional quantities for unit products', async () => {
    await expect(new EntryService(repository()).create({ items: [{ productId: simple.id, quantity: 1.5, unitCost: 2 }] }, 'user-id')).rejects.toMatchObject({ code: 'INVALID_UNIT_QUANTITY' });
  });

  it('does not update a closed entry', async () => {
    const repo = repository({ updateDraft: jest.fn(async () => null), findById: jest.fn(async () => ({ ...entry, status: 'CONFIRMADA' } as EntryWithItems)) });
    await expect(new EntryService(repo).update(entry.id, draft, 'user-id')).rejects.toMatchObject({ code: 'ENTRY_NOT_EDITABLE' });
  });

  it('updates an in-progress entry with a replacement item list', async () => {
    const repo = repository();
    await expect(new EntryService(repo).update(entry.id, draft, 'user-id')).resolves.toBe(entry);
    expect(repo.updateDraft).toHaveBeenCalledWith(entry.id, expect.objectContaining({ items: draft.items, actorUserId: 'user-id' }));
  });
});
