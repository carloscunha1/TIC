import type { CustomerStatus } from '@prisma/client';
import type { CustomerRepository } from './customer.repository.js';
import type { ListCustomersQuery } from './customer.list.schemas.js';

export class CustomerListService {
  constructor(private readonly repository: CustomerRepository) {}

  async list(query: ListCustomersQuery) {
    const result = await this.repository.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search || undefined,
      phoneSearch: query.search?.replace(/\D/g, '') || undefined,
      status: query.status as CustomerStatus | undefined,
    });
    const customers = result.customers.map(({ id, name, phone, status, createdAt }) => ({ id, name, phone, status, createdAt }));
    return { customers, total: result.total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(result.total / query.pageSize) };
  }
}
