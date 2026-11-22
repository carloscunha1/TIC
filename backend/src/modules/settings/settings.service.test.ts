import { describe, expect, it, jest } from '@jest/globals';
import type { EstablishmentSettingsRepository } from './settings.repository.js';
import { EstablishmentSettingsService, isValidCnpj } from './settings.service.js';

describe('EstablishmentSettingsService', () => {
  it('validates CNPJ and normalizes optional values', async () => {
    const repository: EstablishmentSettingsRepository = {
      get: jest.fn(async () => null),
      upsert: jest.fn(async () => ({ id: 'settings-1', name: 'Conveniência', cnpj: '11222333000181', phone: '16999999999', address: 'Rua A', createdAt: new Date(), updatedAt: new Date() })),
    };
    const service = new EstablishmentSettingsService(repository);

    await expect(service.update({
      name: 'Conveniência',
      cnpj: '11.222.333/0001-81',
      phone: '(16) 99999-9999',
      address: 'Rua A',
    }, 'admin-1', '127.0.0.1')).resolves.toMatchObject({ cnpj: '11222333000181', phone: '16999999999' });
    expect(repository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      cnpj: '11222333000181',
      phone: '16999999999',
      actorUserId: 'admin-1',
    }));
  });

  it('rejects invalid CNPJ', async () => {
    const repository: EstablishmentSettingsRepository = {
      get: jest.fn(async () => null),
      upsert: jest.fn(async () => { throw new Error('should not run'); }),
    };
    await expect(new EstablishmentSettingsService(repository).update({
      name: 'Conveniência',
      cnpj: '11.111.111/1111-11',
      phone: '',
      address: '',
    }, 'admin-1')).rejects.toMatchObject({ code: 'INVALID_CNPJ' });
  });

  it('recognizes a valid CNPJ', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
  });
});
