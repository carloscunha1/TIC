import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { isValidDocument, normalizeDocument } from './supplier.service.js';
import type { UpdateSupplierInput } from './supplier.schemas.js';
import type { SupplierRepository } from './supplier.repository.js';

export class SupplierUpdateService {
  constructor(private readonly repository: SupplierRepository) {}

  async get(id: string) {
    const supplier = await this.repository.findById(id);
    if (!supplier) throw new ApiError(404, 'SUPPLIER_NOT_FOUND', 'Fornecedor não encontrado.');
    return supplier;
  }

  async update(id: string, input: UpdateSupplierInput, actorUserId: string, ipAddress?: string) {
    const document = input.document ? normalizeDocument(input.document) : undefined;
    if (document && !isValidDocument(document)) throw new ApiError(400, 'INVALID_DOCUMENT', 'CPF/CNPJ inválido.');
    try {
      return await this.repository.update(id, { actorUserId, document, email: input.email || undefined, ipAddress, name: input.name.trim(), notes: input.notes || undefined, phone: input.phone || undefined });
    } catch (error) {
      if (error instanceof Error && error.message === 'SUPPLIER_NOT_FOUND') throw new ApiError(404, 'SUPPLIER_NOT_FOUND', 'Fornecedor não encontrado.');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'DOCUMENT_ALREADY_EXISTS', 'Já existe um fornecedor com este documento.');
      throw error;
    }
  }
}
