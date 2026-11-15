import { describe, expect, it, jest } from '@jest/globals';
import type { Supplier } from '@prisma/client';
import type { SupplierRepository } from './supplier.repository.js';
import { SupplierListService } from './supplier.list.service.js';

const supplier: Supplier = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Distribuidora', document: '52998224725', phone: '11999999999', email: 'contato@example.com', notes: 'Notas', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('SupplierListService.list', () => {
  it('returns filtered pagination data', async () => {
    const repo: SupplierRepository = { create: jest.fn(), list: jest.fn(async () => ({ suppliers: [supplier], total: 21 })) };
    const result = await new SupplierListService(repo).list({ page: 2, pageSize: 20, name: 'dist', status: 'ACTIVE' });
    expect(result).toMatchObject({ page: 2, total: 21, totalPages: 2 });
    expect(result.suppliers[0]).toMatchObject({ name: 'Distribuidora', status: 'ACTIVE' });
    expect(repo.list).toHaveBeenCalledWith({ page: 2, pageSize: 20, name: 'dist', status: 'ACTIVE' });
  });
});
