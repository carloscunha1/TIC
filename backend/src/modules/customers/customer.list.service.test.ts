import { describe, expect, it, jest } from '@jest/globals';
import type { CustomerListRecord, CustomerRepository } from './customer.repository.js';
import { listCustomersQuerySchema } from './customer.list.schemas.js';
import { CustomerListService } from './customer.list.service.js';

const createdAt = new Date('2026-11-15T12:00:00.000Z');
const safeCustomer: CustomerListRecord = { id: 'customer-1', name: 'Ana Cliente', phone: '5516999999999', status: 'PENDING_PIN', createdAt };

describe('CustomerListService', () => {
  it('normalizes pagination, searches by name/phone and filters by status', async () => {
    const repository: CustomerRepository = {
      create: jest.fn(),
      list: jest.fn(async () => ({ customers: [safeCustomer], total: 41 })),
      findById: jest.fn(), update: jest.fn(),
    };
    const query = listCustomersQuerySchema.parse({ page: '3', pageSize: '20', search: '+55 (16) 99999-9999', status: 'PENDING_PIN' });
    const result = await new CustomerListService(repository).list(query);

    expect(repository.list).toHaveBeenCalledWith({ page: 3, pageSize: 20, search: '+55 (16) 99999-9999', phoneSearch: '5516999999999', status: 'PENDING_PIN' });
    expect(result).toMatchObject({ page: 3, pageSize: 20, total: 41, totalPages: 3, customers: [{ id: 'customer-1', status: 'PENDING_PIN' }] });
  });

  it('returns only approved fields and does not expose credential data', async () => {
    const recordWithCredential = { ...safeCustomer, pinHash: 'must-not-leak', pinFailedAttempts: 4 } as CustomerListRecord;
    const repository: CustomerRepository = { create: jest.fn(), list: jest.fn(async () => ({ customers: [recordWithCredential], total: 1 })), findById: jest.fn(), update: jest.fn() };
    const result = await new CustomerListService(repository).list(listCustomersQuerySchema.parse({}));

    expect(result.customers[0]).toEqual(safeCustomer);
    expect(JSON.stringify(result)).not.toMatch(/pinHash|pinFailedAttempts|must-not-leak/);
  });

  it('rejects invalid pagination and status filters', () => {
    expect(() => listCustomersQuerySchema.parse({ page: '0' })).toThrow();
    expect(() => listCustomersQuerySchema.parse({ pageSize: '101' })).toThrow();
    expect(listCustomersQuerySchema.parse({ status: 'INACTIVE' }).status).toBe('INACTIVE');
  });
});
