import type { Customer } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateCustomerData = {
  name: string;
  phone: string;
  actorUserId: string;
  ipAddress?: string;
  source: 'ADMIN' | 'QUICK';
};

export interface CustomerRepository {
  create(data: CreateCustomerData): Promise<Customer>;
}

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly auditService: AuditService) {}

  create(data: CreateCustomerData): Promise<Customer> {
    return prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.create({
        data: {
          name: data.name,
          phone: data.phone,
          privacyNoticeAcknowledgedAt: new Date(),
          createdById: data.actorUserId,
          status: 'PENDING_PIN',
        },
      });
      await this.auditService.record({
        actor: { type: 'USER', userId: data.actorUserId },
        action: data.source === 'QUICK' ? 'CUSTOMER_QUICKLY_CREATED' : 'CUSTOMER_CREATED',
        after: { id: customer.id, name: customer.name, phone: customer.phone, status: customer.status, privacyNoticeAcknowledgedAt: customer.privacyNoticeAcknowledgedAt },
        entity: 'Customer',
        entityId: customer.id,
        ipAddress: data.ipAddress,
      }, transaction);
      return customer;
    });
  }
}

