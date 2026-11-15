import type { SupplierStatus } from '@prisma/client';
import type { SupplierRepository } from './supplier.repository.js';
import type { ListSuppliersQuery } from './supplier.list.schemas.js';

export class SupplierListService {
  constructor(private readonly repository: SupplierRepository) {}

  async list(query: ListSuppliersQuery) {
    const result = await this.repository.list({ page: query.page, pageSize: query.pageSize, name: query.name || undefined, status: query.status as SupplierStatus | undefined });
    return { page: query.page, pageSize: query.pageSize, suppliers: result.suppliers.map(({ createdAt, document, email, id, name, notes, phone, status }) => ({ createdAt, document, email, id, name, notes, phone, status })), total: result.total, totalPages: Math.ceil(result.total / query.pageSize) };
  }
}
