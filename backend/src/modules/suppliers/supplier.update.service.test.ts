import { describe, expect, it, jest } from '@jest/globals';
import type { Supplier } from '@prisma/client';
import type { SupplierRepository } from './supplier.repository.js';
import { SupplierUpdateService } from './supplier.update.service.js';

const supplier: Supplier = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Distribuidora', document: '52998224725', phone: null, email: null, notes: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('SupplierUpdateService.update', () => {
  it('updates supplier data and normalizes the document', async () => {
    const repo: SupplierRepository = { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(async () => supplier), updateStatus: jest.fn() };
    await new SupplierUpdateService(repo).update(supplier.id, { name: 'Novo', document: '529.982.247-25' }, 'user-id');
    expect(repo.update).toHaveBeenCalledWith(supplier.id, expect.objectContaining({ document: '52998224725', name: 'Novo' }));
  });

  it('rejects an invalid document', async () => {
    const repo: SupplierRepository = { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn() };
    await expect(new SupplierUpdateService(repo).update(supplier.id, { name: 'Novo', document: '000.000.000-00' }, 'user-id')).rejects.toMatchObject({ code: 'INVALID_DOCUMENT', statusCode: 400 });
  });
});
