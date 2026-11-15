import { describe, expect, it, jest } from '@jest/globals';
import type { Supplier } from '@prisma/client';
import type { SupplierRepository } from './supplier.repository.js';
import { SupplierService } from './supplier.service.js';

const supplier: Supplier = { id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c', name: 'Distribuidora', document: '52998224725', phone: null, email: null, notes: null, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() };

describe('SupplierService.create', () => {
  it('normalizes and accepts a valid CPF', async () => {
    const repo: SupplierRepository = { create: jest.fn(async () => supplier), findById: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn() };
    await new SupplierService(repo).create({ name: ' Distribuidora ', document: '529.982.247-25' }, 'user-id');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ document: '52998224725', name: 'Distribuidora' }));
  });

  it('rejects invalid documents and allows absent documents', async () => {
    const repo: SupplierRepository = { create: jest.fn(async () => supplier), findById: jest.fn(), list: jest.fn(), update: jest.fn(), updateStatus: jest.fn() };
    await expect(new SupplierService(repo).create({ name: 'Sem documento' }, 'user-id')).resolves.toBe(supplier);
    await expect(new SupplierService(repo).create({ name: 'Inválido', document: '111.111.111-11' }, 'user-id')).rejects.toMatchObject({ code: 'INVALID_DOCUMENT', statusCode: 400 });
  });
});
