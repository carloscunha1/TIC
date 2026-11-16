import { Prisma } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { ApiError } from '../../shared/http/api-error.js';
import type { CustomerRepository } from './customer.repository.js';
import { CustomerService } from './customer.service.js';

const actorUserId = 'b589c761-66e4-4b94-93bb-bf1169791e6e';
const customer = {
  id: '3c4c6a14-80b8-4a55-a7e1-5c31d13e6b4c',
  name: 'Ana Cliente',
  phone: '5516999999999',
  status: 'PENDING_PIN',
  privacyNoticeAcknowledgedAt: new Date('2026-11-15T12:00:00.000Z'),
  createdById: actorUserId,
  createdAt: new Date('2026-11-15T12:00:00.000Z'),
  updatedAt: new Date('2026-11-15T12:00:00.000Z'),
} as const;

describe('CustomerService.create', () => {
  it('normalizes phone and creates a pending customer after privacy acknowledgment', async () => {
    const repository: CustomerRepository = { create: jest.fn(async () => customer), list: jest.fn(), findById: jest.fn(), update: jest.fn() };
    const result = await new CustomerService(repository).create({ name: ' Ana Cliente ', phone: '+55 (16) 99999-9999', privacyNoticeAcknowledged: true }, actorUserId, 'QUICK');

    expect(result.status).toBe('PENDING_PIN');
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Cliente', phone: '5516999999999', actorUserId, source: 'QUICK' }));
  });

  it('requires name, phone and privacy acknowledgment', async () => {
    const repository: CustomerRepository = { create: jest.fn(async () => customer), list: jest.fn(), findById: jest.fn(), update: jest.fn() };
    const service = new CustomerService(repository);
    await expect(service.create({ name: 'A', phone: '16999999999', privacyNoticeAcknowledged: true }, actorUserId, 'ADMIN')).rejects.toBeInstanceOf(Error);
    await expect(service.create({ name: 'Ana Cliente', phone: '16999999999', privacyNoticeAcknowledged: false as never }, actorUserId, 'ADMIN')).rejects.toBeInstanceOf(Error);
    await expect(service.create({ name: 'Ana Cliente', phone: '---', privacyNoticeAcknowledged: true }, actorUserId, 'ADMIN')).rejects.toMatchObject({ code: 'INVALID_PHONE' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('reports duplicate phones as a conflict without creating another customer', async () => {
    const repository: CustomerRepository = { create: jest.fn(async () => { throw new Prisma.PrismaClientKnownRequestError('unique constraint', { code: 'P2002', clientVersion: 'test' }); }), list: jest.fn(), findById: jest.fn(), update: jest.fn() };
    await expect(new CustomerService(repository).create({ name: 'Ana Cliente', phone: '16999999999', privacyNoticeAcknowledged: true }, actorUserId, 'ADMIN'))
      .rejects.toMatchObject<ApiError>({ statusCode: 409, code: 'CUSTOMER_PHONE_ALREADY_EXISTS' });
  });
});

describe('CustomerService.update', () => {
  const profile = { id: customer.id, name: customer.name, phone: customer.phone, status: 'PENDING_PIN', privacyNoticeAcknowledgedAt: customer.privacyNoticeAcknowledgedAt, createdAt: customer.createdAt, updatedAt: customer.updatedAt } as const;

  it('updates name and normalized phone while leaving status and consent unchanged', async () => {
    const repository: CustomerRepository = {
      create: jest.fn(), list: jest.fn(), findById: jest.fn(async () => profile),
      update: jest.fn(async () => ({ ...profile, name: 'Ana Nova', phone: '5516333333333' })),
    };
    const result = await new CustomerService(repository).update(customer.id, { name: ' Ana Nova ', phone: '+55 (16) 33333-3333' }, actorUserId);
    expect(repository.update).toHaveBeenCalledWith(customer.id, { name: 'Ana Nova', phone: '5516333333333', actorUserId, ipAddress: undefined });
    expect(result).toMatchObject({ status: 'PENDING_PIN', privacyNoticeAcknowledgedAt: profile.privacyNoticeAcknowledgedAt });
  });

  it('rejects invalid input, missing customer and a phone already used by another customer', async () => {
    const repository: CustomerRepository = {
      create: jest.fn(), list: jest.fn(), findById: jest.fn(async () => null),
      update: jest.fn(async () => { throw new Prisma.PrismaClientKnownRequestError('unique constraint', { code: 'P2002', clientVersion: 'test' }); }),
    };
    const service = new CustomerService(repository);
    await expect(service.update(customer.id, { name: 'A', phone: '16999999999' }, actorUserId)).rejects.toThrow();
    await expect(service.get(customer.id)).rejects.toMatchObject({ statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
    await expect(service.update(customer.id, { name: 'Ana Nova', phone: '16999999999' }, actorUserId)).rejects.toMatchObject({ statusCode: 409, code: 'CUSTOMER_PHONE_ALREADY_EXISTS' });
  });
});
