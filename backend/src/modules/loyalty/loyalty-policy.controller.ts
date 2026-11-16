import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { updateLoyaltyPolicySchema } from './loyalty-policy.schemas.js';
import { PrismaLoyaltyPolicyRepository } from './loyalty-policy.repository.js';
import { LoyaltyPolicyService } from './loyalty-policy.service.js';
const service = new LoyaltyPolicyService(new PrismaLoyaltyPolicyRepository(new AuditService(new PrismaAuditRepository())));
export async function getLoyaltyPolicy(_request: Request, response: Response) {
  const [current, history] = await Promise.all([service.current(), service.history()]);
  response.status(200).json({ success: true, data: { current, history }, requestId: response.locals.requestId });
}
export async function updateLoyaltyPolicy(request: Request, response: Response) {
  const result = await service.update(updateLoyaltyPolicySchema.parse(request.body), response.locals.auth.userId, request.ip);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}
