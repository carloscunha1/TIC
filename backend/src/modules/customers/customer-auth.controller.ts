import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { PrismaCustomerAuthRepository } from './customer-auth.repository.js';
import { clearCustomerSessionCookie, readCustomerSessionCookie, setCustomerSessionCookie } from './customer-auth.cookies.js';
import { completeCustomerPinSetupSchema, customerLoginSchema } from './customer-auth.schemas.js';
import { customerSessionService } from './customer-auth.middleware.js';
const service = new CustomerAuthService(new PrismaCustomerAuthRepository(new AuditService(new PrismaAuditRepository())));
export async function completeCustomerPinSetup(request: Request, response: Response) {
  await service.completePinSetup(completeCustomerPinSetupSchema.parse(request.body));
  response.status(204).send();
}
export async function loginCustomer(request: Request, response: Response) {
  const session = await service.login(customerLoginSchema.parse(request.body), request.ip);
  setCustomerSessionCookie(response, session.sessionToken, session.expiresAt);
  response.status(200).json({ success: true, data: { expiresAt: session.expiresAt }, requestId: response.locals.requestId });
}
export function getCustomerSession(_request: Request, response: Response) {
  response.status(200).json({ success: true, data: response.locals.customerAuth, requestId: response.locals.requestId });
}
export async function logoutCustomer(request: Request, response: Response) {
  await customerSessionService.logout(readCustomerSessionCookie(request.header('cookie')));
  clearCustomerSessionCookie(response);
  response.status(204).send();
}
