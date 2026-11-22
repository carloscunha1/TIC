import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { PrismaCustomerAuthRepository } from './customer-auth.repository.js';
import { clearCustomerSessionCookie, readCustomerSessionCookie, setCustomerSessionCookie } from './customer-auth.cookies.js';
import { completeCustomerPinSetupSchema, customerLoginSchema } from './customer-auth.schemas.js';
import { customerSessionService } from './customer-auth.middleware.js';
import { PrismaCustomerPublicLoyaltyRepository } from './customer-public-loyalty.repository.js';
import { CustomerPublicLoyaltyService } from './customer-public-loyalty.service.js';
import { PrismaLoyaltyRepository } from '../loyalty/loyalty.repository.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
const service = new CustomerAuthService(new PrismaCustomerAuthRepository(new AuditService(new PrismaAuditRepository())));
const publicLoyaltyService = new CustomerPublicLoyaltyService(
  new PrismaCustomerPublicLoyaltyRepository(),
  new LoyaltyService(new PrismaLoyaltyRepository()),
);
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

export async function getPublicCustomerLoyalty(_request: Request, response: Response): Promise<void> {
  const summary = await publicLoyaltyService.getSummary(response.locals.customerAuth.customerId);
  response.status(200).json({ success: true, data: summary, requestId: response.locals.requestId });
}
