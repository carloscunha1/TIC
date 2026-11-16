import type { Request, Response } from 'express';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaCustomerRepository } from './customer.repository.js';
import { CustomerService } from './customer.service.js';
import { createCustomerSchema } from './customer.schemas.js';
import { CustomerListService } from './customer.list.service.js';
import { listCustomersQuerySchema } from './customer.list.schemas.js';

const customerService = new CustomerService(new PrismaCustomerRepository(new AuditService(new PrismaAuditRepository())));
const customerListService = new CustomerListService(new PrismaCustomerRepository(new AuditService(new PrismaAuditRepository())));

export async function listCustomers(request: Request, response: Response): Promise<void> {
  const query = listCustomersQuerySchema.parse(request.query);
  const result = await customerListService.list(query);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function createCustomer(request: Request, response: Response): Promise<void> {
  const input = createCustomerSchema.parse(request.body);
  const customer = await customerService.create(input, response.locals.auth.userId, 'ADMIN', request.ip);
  response.status(201).json({ success: true, data: { customer }, requestId: response.locals.requestId });
}

export async function quickCreateCustomer(request: Request, response: Response): Promise<void> {
  const input = createCustomerSchema.parse(request.body);
  const customer = await customerService.create(input, response.locals.auth.userId, 'QUICK', request.ip);
  response.status(201).json({ success: true, data: { customer }, requestId: response.locals.requestId });
}
