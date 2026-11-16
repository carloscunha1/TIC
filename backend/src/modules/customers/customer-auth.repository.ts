import type { Customer, CustomerSession } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CustomerForLogin = Pick<Customer, 'id' | 'name' | 'status' | 'pinHash' | 'pinFailedAttempts' | 'pinLockedUntil'>;
export type CustomerLoginSessionData = { id: string; customerId: string; tokenHash: string; expiresAt: Date };

export interface CustomerLoginUnitOfWork {
  recordFailure(customerId: string, attempts: number, lockedUntil: Date | null, ipAddress?: string): Promise<void>;
  recordRejected(customerId?: string, ipAddress?: string): Promise<void>;
  resetFailures(customerId: string): Promise<void>;
  createSession(data: CustomerLoginSessionData, ipAddress?: string): Promise<CustomerSession>;
}

export interface CustomerAuthRepository {
  requestPinSetup(customerId: string, tokenHash: string, expiresAt: Date, actorUserId: string, ipAddress?: string): Promise<void>;
  completePinSetup(tokenHash: string, pinHash: string, now: Date): Promise<'INITIAL' | 'RESET'>;
  withLockedCustomerByPhone<T>(phone: string, operation: (customer: CustomerForLogin | null, unit: CustomerLoginUnitOfWork) => Promise<T>): Promise<T>;
}

export class PrismaCustomerAuthRepository implements CustomerAuthRepository {
  constructor(private readonly auditService: AuditService) {}

  requestPinSetup(customerId: string, tokenHash: string, expiresAt: Date, actorUserId: string, ipAddress?: string): Promise<void> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "customers" WHERE "id" = ${customerId}::uuid FOR UPDATE`;
      const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true, status: true, pinHash: true } });
      if (!customer) throw new Error('CUSTOMER_NOT_FOUND');
      if (customer.status === 'INACTIVE') throw new Error('CUSTOMER_INACTIVE');
      await tx.customer.update({ where: { id: customerId }, data: { pinSetupTokenHash: tokenHash, pinSetupTokenExpiresAt: expiresAt } });
      await this.auditService.record({
        actor: { type: 'USER', userId: actorUserId },
        action: customer.pinHash ? 'CUSTOMER_PIN_RESET_REQUESTED' : 'CUSTOMER_PIN_SETUP_REQUESTED',
        after: { customerId, status: customer.status, expiresAt },
        entity: 'Customer', entityId: customerId, ipAddress,
      }, tx);
    });
  }

  completePinSetup(tokenHash: string, pinHash: string, now: Date): Promise<'INITIAL' | 'RESET'> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "customers" WHERE "pin_setup_token_hash" = ${tokenHash} AND "pin_setup_token_expires_at" > ${now} FOR UPDATE`;
      if (!rows.length) throw new Error('PIN_SETUP_LINK_INVALID');
      const before = await tx.customer.findUniqueOrThrow({ where: { id: rows[0]!.id }, select: { id: true, status: true, pinHash: true } });
      if (before.status === 'INACTIVE') throw new Error('PIN_SETUP_LINK_INVALID');
      const status = before.status === 'PENDING_PIN' ? 'ACTIVE' : before.status;
      const customer = await tx.customer.update({
        where: { id: before.id },
        data: { pinHash, status, pinFailedAttempts: 0, pinLockedUntil: null, pinSetupTokenHash: null, pinSetupTokenExpiresAt: null },
        select: { id: true, status: true },
      });
      await this.auditService.record({
        actor: { type: 'SYSTEM' },
        action: before.pinHash ? 'CUSTOMER_PIN_RESET' : 'CUSTOMER_PIN_DEFINED',
        before: { customerId: before.id, status: before.status },
        after: { customerId: customer.id, status: customer.status },
        entity: 'Customer', entityId: customer.id,
      }, tx);
      return before.pinHash ? 'RESET' : 'INITIAL';
    });
  }

  withLockedCustomerByPhone<T>(phone: string, operation: (customer: CustomerForLogin | null, unit: CustomerLoginUnitOfWork) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "customers" WHERE "phone" = ${phone} FOR UPDATE`;
      const customer = rows.length ? await tx.customer.findUnique({ where: { id: rows[0]!.id }, select: { id: true, name: true, status: true, pinHash: true, pinFailedAttempts: true, pinLockedUntil: true } }) : null;
      return operation(customer, {
        recordFailure: async (customerId, attempts, lockedUntil, ipAddress) => {
          await tx.customer.update({ where: { id: customerId }, data: { pinFailedAttempts: attempts, pinLockedUntil: lockedUntil } });
          await this.auditService.record({ actor: { type: 'SYSTEM' }, action: 'CUSTOMER_AUTHENTICATION_FAILED', after: { customerId, attempts, locked: Boolean(lockedUntil) }, entity: 'Customer', entityId: customerId, ipAddress }, tx);
        },
        recordRejected: async (customerId, ipAddress) => {
          await this.auditService.record({ actor: { type: 'SYSTEM' }, action: 'CUSTOMER_AUTHENTICATION_FAILED', after: { customerId, outcome: 'INVALID_CREDENTIALS' }, entity: 'Customer', entityId: customerId, ipAddress }, tx);
        },
        resetFailures: async (customerId) => { await tx.customer.update({ where: { id: customerId }, data: { pinFailedAttempts: 0, pinLockedUntil: null } }); },
        createSession: async (data, ipAddress) => {
          const session = await tx.customerSession.create({ data });
          await this.auditService.record({ actor: { type: 'SYSTEM' }, action: 'CUSTOMER_AUTHENTICATION_SUCCEEDED', after: { customerId: data.customerId, sessionId: session.id }, entity: 'Customer', entityId: data.customerId, ipAddress }, tx);
          return session;
        },
      });
    });
  }
}
