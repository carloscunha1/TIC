import { ApiError } from '../../shared/http/api-error.js';
import type { SupplierStatus } from '@prisma/client';
import type { SupplierRepository } from './supplier.repository.js';

export class SupplierStatusService {
  constructor(private readonly repository: SupplierRepository) {}

  async update(id: string, status: SupplierStatus, actorUserId: string, ipAddress?: string) {
    try { return await this.repository.updateStatus(id, status, actorUserId, ipAddress); } catch (error) { if (error instanceof Error && error.message === 'SUPPLIER_NOT_FOUND') throw new ApiError(404, 'SUPPLIER_NOT_FOUND', 'Fornecedor não encontrado.'); throw error; }
  }
}
