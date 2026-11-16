import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import {
  awardLoyaltyPoints,
  getLoyaltyBalance,
  redeemLoyaltyPoints,
  reverseLoyaltyAward,
  reverseLoyaltyRedemption,
} from './loyalty.controller.js';

export const loyaltyRouter = Router();
loyaltyRouter.use(requireAuth);
loyaltyRouter.get('/customers/:customerId/balance', requirePermission(permissions.loyaltyRead), getLoyaltyBalance);
loyaltyRouter.post('/awards', requirePermission(permissions.salesManage), awardLoyaltyPoints);
loyaltyRouter.post('/redemptions', requirePermission(permissions.salesManage), redeemLoyaltyPoints);
loyaltyRouter.post('/award-reversals', requirePermission(permissions.salesManage), reverseLoyaltyAward);
loyaltyRouter.post('/redemption-reversals', requirePermission(permissions.salesManage), reverseLoyaltyRedemption);
