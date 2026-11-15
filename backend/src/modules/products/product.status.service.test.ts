import { describe, expect, it, jest } from '@jest/globals';
import type { Product, ProductStatus } from '@prisma/client';
import type { ProductRepository } from './product.repository.js';
import { ProductStatusService } from './product.status.service.js';

const product = { id: 'product-id', status: 'INACTIVE' } as Product;

describe('ProductStatusService', () => {
  it('delegates inactivation/reactivation to audited status update without touching stock or history', async () => {
    const repository: ProductRepository = { findActiveCategory: jest.fn(), findById: jest.fn(), create: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(async () => product), listValueHistory: jest.fn() };
    await new ProductStatusService(repository).update(product.id, 'INACTIVE' as ProductStatus, 'actor-id', '127.0.0.1');
    expect(repository.updateStatus).toHaveBeenCalledWith(product.id, 'INACTIVE', 'actor-id', '127.0.0.1');
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.listValueHistory).not.toHaveBeenCalled();
  });

  it('returns a not-found error for an unknown product', async () => {
    const repository: ProductRepository = { findActiveCategory: jest.fn(), findById: jest.fn(), create: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(async () => { throw new Error('PRODUCT_NOT_FOUND'); }), listValueHistory: jest.fn() };
    await expect(new ProductStatusService(repository).update('missing', 'INACTIVE', 'actor-id')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', statusCode: 404 });
  });
});
