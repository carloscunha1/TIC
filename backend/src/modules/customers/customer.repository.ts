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

export interface CustomerRepository {
  create(data: CreateCustomerData): Promise<Customer>;
  list(filters: CustomerListFilters): Promise<{ customers: CustomerListRecord[]; total: number }>;
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
}

