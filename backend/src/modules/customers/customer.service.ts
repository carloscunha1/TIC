import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { createCustomerSchema, updateCustomerSchema, type CreateCustomerInput, type UpdateCustomerInput } from './customer.schemas.js';
import type { CustomerRepository } from './customer.repository.js';

export class CustomerService {
  constructor(private readonly repository: CustomerRepository) {}

  async create(input: CreateCustomerInput, actorUserId: string, source: 'ADMIN' | 'QUICK', ipAddress?: string) {
    const data = createCustomerSchema.parse(input);
    const phone = data.phone.replace(/\D/g, '');
    if (!phone) throw new ApiError(400, 'INVALID_PHONE', 'Informe um telefone válido.');
    try {
      return await this.repository.create({ name: data.name, phone, actorUserId, source, ipAddress });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'CUSTOMER_PHONE_ALREADY_EXISTS', 'Já existe um cliente cadastrado com este telefone.');
      }
      throw error;
    }
  }

  async get(id: string) {
    const customer = await this.repository.findById(id);
    if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
    return customer;
  }

  async update(id: string, input: UpdateCustomerInput, actorUserId: string, ipAddress?: string) {
    const data = updateCustomerSchema.parse(input);
    const phone = data.phone.replace(/\D/g, '');
    if (!phone) throw new ApiError(400, 'INVALID_PHONE', 'Informe um telefone válido.');
    try {
      return await this.repository.update(id, { name: data.name, phone, actorUserId, ipAddress });
    } catch (error) {
      if (error instanceof Error && error.message === 'CUSTOMER_NOT_FOUND') throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'CUSTOMER_PHONE_ALREADY_EXISTS', 'Já existe um cliente cadastrado com este telefone.');
      }
      throw error;
    }
  }
}
