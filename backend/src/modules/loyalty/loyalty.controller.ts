import type { Request, Response } from 'express';
import { PrismaLoyaltyRepository } from './loyalty.repository.js';
import {
  awardPointsSchema,
  redeemPointsSchema,
  reverseAwardSchema,
  reverseRedemptionSchema,
  customerBalanceParamsSchema,
} from './loyalty.schemas.js';
import { LoyaltyService } from './loyalty.service.js';

const service = new LoyaltyService(new PrismaLoyaltyRepository());

export async function getLoyaltyBalance(request: Request, response: Response): Promise<void> {
  const { customerId } = customerBalanceParamsSchema.parse(request.params);
  const result = await service.balance(customerId);
  response.status(200).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function awardLoyaltyPoints(request: Request, response: Response): Promise<void> {
  const input = awardPointsSchema.parse(request.body);
  const result = await service.award({ ...input, actorUserId: response.locals.auth.userId });
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function redeemLoyaltyPoints(request: Request, response: Response): Promise<void> {
  const input = redeemPointsSchema.parse(request.body);
  const result = await service.redeem({ ...input, actorUserId: response.locals.auth.userId });
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function reverseLoyaltyAward(request: Request, response: Response): Promise<void> {
  const input = reverseAwardSchema.parse(request.body);
  const result = await service.reverseAward({ ...input, actorUserId: response.locals.auth.userId });
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}

export async function reverseLoyaltyRedemption(request: Request, response: Response): Promise<void> {
  const input = reverseRedemptionSchema.parse(request.body);
  const result = await service.reverseRedemption({ ...input, actorUserId: response.locals.auth.userId });
  response.status(201).json({ success: true, data: result, requestId: response.locals.requestId });
}
