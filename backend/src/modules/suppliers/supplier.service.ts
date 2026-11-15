import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import type { CreateSupplierInput } from './supplier.schemas.js';
import type { SupplierRepository } from './supplier.repository.js';

export class SupplierService {
  constructor(private readonly repository: SupplierRepository) {}

  async create(input: CreateSupplierInput, actorUserId: string, ipAddress?: string) {
    const document = input.document ? normalizeDocument(input.document) : undefined;
    if (document && !isValidDocument(document)) throw new ApiError(400, 'INVALID_DOCUMENT', 'CPF/CNPJ inválido.');
    try {
      return await this.repository.create({ actorUserId, document, email: input.email || undefined, ipAddress, name: input.name.trim(), notes: input.notes || undefined, phone: input.phone || undefined });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'DOCUMENT_ALREADY_EXISTS', 'Já existe um fornecedor com este documento.');
      throw error;
    }
  }
}

export function normalizeDocument(value: string): string { return value.replace(/\D/g, ''); }

export function isValidDocument(value: string): boolean {
  if (![11, 14].includes(value.length) || /^([0-9])\1+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const calculate = (weights: number[], offset: number): number => { const sum = weights.reduce((total, weight, index) => total + digits[offset + index] * weight, 0); const remainder = sum % 11; return remainder < 2 ? 0 : 11 - remainder; };
  if (value.length === 11) return calculate([10, 9, 8, 7, 6, 5, 4, 3, 2], 0) === digits[9] && calculate([11, 10, 9, 8, 7, 6, 5, 4, 3, 2], 0) === digits[10];
  return calculate([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 0) === digits[12] && calculate([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 0) === digits[13];
}
