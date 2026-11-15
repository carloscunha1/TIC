import { describe, expect, it, jest } from '@jest/globals';
import type { Supplier } from '@prisma/client';
import type { SupplierRepository } from './supplier.repository.js';
import { SupplierStatusService } from './supplier.status.service.js';

const supplier: Supplier = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Distribuidora', document: null, phone: null, email: null, notes: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('SupplierStatusService.update', () => {
  it('changes status', async () => {
    const repo: SupplierRepository = { create: jest.fn(), findById: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn(async () => ({ ...supplier, status: 'INACTIVE' })) };
    await expect(new SupplierStatusService(repo).update(supplier.id, 'INACTIVE', 'user-id')).resolves.toMatchObject({ status: 'INACTIVE' });
  });
});
