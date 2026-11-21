import { describe, expect, it, jest } from '@jest/globals';
import type { Customer, Product } from '@prisma/client';
import type { SaleRepository } from './sale.repository.js';
import { SaleService } from './sale.service.js';

const product = { id: '45b53188-613a-4a8e-a529-111111111111', status: 'ACTIVE', unit: 'UN', salePrice: { toString: () => '4.5' } } as unknown as Product;
const customer = { id: '45b53188-613a-4a8e-a529-222222222222', status: 'ACTIVE' } as Customer;
const sale = { id: '45b53188-613a-4a8e-a529-333333333333', status: 'EM_ANDAMENTO', items: [{ id: '45b53188-613a-4a8e-a529-444444444444', product: { unit: 'UN' } }] } as never;

function repository(overrides: Partial<SaleRepository> = {}): SaleRepository {
  return {
    findActiveCustomer: jest.fn(async () => customer),
    findActiveProducts: jest.fn(async () => [product]),
    findActiveProduct: jest.fn(async () => product),
    createDraft: jest.fn(async () => sale),
    updateDraft: jest.fn(async () => sale),
    addItem: jest.fn(async () => sale),
    updateItem: jest.fn(async () => sale),
    removeItem: jest.fn(async () => sale),
    findById: jest.fn(async () => sale),
    list: jest.fn(async () => ({ sales: [], total: 0 })),
    ...overrides,
  };
}

describe('SaleService', () => {
  it('creates a draft with the current product price and does not reserve stock', async () => {
    const repo = repository();
    await expect(new SaleService(repo).create({ customerId: customer.id, items: [{ productId: product.id, quantity: 2 }] }, 'user-id')).resolves.toBe(sale);
    expect(repo.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ productId: product.id, quantity: 2, unitPrice: 4.5 }],
      actorUserId: 'user-id',
    }));
  });

  it('requires an active customer and active products', async () => {
    await expect(new SaleService(repository({ findActiveCustomer: jest.fn(async () => null) })).create({ customerId: customer.id, items: [{ productId: product.id, quantity: 1 }] }, 'user-id')).rejects.toMatchObject({ code: 'CUSTOMER_INACTIVE_OR_NOT_FOUND' });
    await expect(new SaleService(repository({ findActiveProducts: jest.fn(async () => []) })).create({ items: [{ productId: product.id, quantity: 1 }] }, 'user-id')).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE_OR_NOT_FOUND' });
  });

  it('rejects fractional quantities for unit products', async () => {
    await expect(new SaleService(repository()).create({ items: [{ productId: product.id, quantity: 1.5 }] }, 'user-id')).rejects.toMatchObject({ code: 'INVALID_UNIT_QUANTITY' });
  });

  it('does not remove the last item from an in-progress sale', async () => {
    await expect(new SaleService(repository()).removeItem(sale.id, sale.items[0].id, 'user-id')).rejects.toMatchObject({ code: 'SALE_REQUIRES_ITEM' });
  });
});
