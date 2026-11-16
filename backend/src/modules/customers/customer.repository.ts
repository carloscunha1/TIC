import type { Customer, CustomerStatus, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export type CreateCustomerData = {
  name: string;
  phone: string;
  actorUserId: string;
  ipAddress?: string;
  source: 'ADMIN' | 'QUICK';
};

export type CustomerListFilters = { page: number; pageSize: number; search?: string; phoneSearch?: string; status?: CustomerStatus };
export type CustomerListRecord = Pick<Customer, 'id' | 'name' | 'phone' | 'status' | 'createdAt'>;
export type CustomerProfile = Pick<Customer, 'id' | 'name' | 'phone' | 'status' | 'privacyNoticeAcknowledgedAt' | 'createdAt' | 'updatedAt'>;
export type UpdateCustomerData = { name: string; phone: string; actorUserId: string; ipAddress?: string };

export interface CustomerRepository {
  create(data: CreateCustomerData): Promise<Customer>;
  list(filters: CustomerListFilters): Promise<{ customers: CustomerListRecord[]; total: number }>;
  findById(id: string): Promise<CustomerProfile | null>;
  update(id: string, data: UpdateCustomerData): Promise<CustomerProfile>;
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

  async list(filters: CustomerListFilters): Promise<{ customers: CustomerListRecord[]; total: number }> {
    const where: Prisma.CustomerWhereInput = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        ...(filters.phoneSearch ? [{ phone: { contains: filters.phoneSearch } }] : []),
      ];
    }
    if (filters.status) where.status = filters.status;
    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true, status: true, createdAt: true },
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.customer.count({ where }),
    ]);
    return { customers, total };
  }

  findById(id: string): Promise<CustomerProfile | null> {
    return prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true, status: true, privacyNoticeAcknowledgedAt: true, createdAt: true, updatedAt: true },
    });
  }

  update(id: string, data: UpdateCustomerData): Promise<CustomerProfile> {
    return prisma.$transaction(async (transaction) => {
      const before = await transaction.customer.findUnique({ where: { id } });
      if (!before) throw new Error('CUSTOMER_NOT_FOUND');
      const customer = await transaction.customer.update({ where: { id }, data: { name: data.name, phone: data.phone }, select: { id: true, name: true, phone: true, status: true, privacyNoticeAcknowledgedAt: true, createdAt: true, updatedAt: true } });
      await this.auditService.record({
        actor: { type: 'USER', userId: data.actorUserId },
        action: 'CUSTOMER_UPDATED',
        before: { id: before.id, name: before.name, phone: before.phone },
        after: { id: customer.id, name: customer.name, phone: customer.phone },
        entity: 'Customer',
        entityId: customer.id,
        ipAddress: data.ipAddress,
      }, transaction);
      return customer;
    });
  }
}

