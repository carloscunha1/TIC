import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requirePermission } from '../auth/authorization.middleware.js';
import { permissions } from '../auth/permissions.js';
import { getLoyaltyPolicy, updateLoyaltyPolicy } from './loyalty-policy.controller.js';
export const loyaltyPolicyRouter = Router();
loyaltyPolicyRouter.use(requireAuth, requirePermission(permissions.loyaltyPolicyManage));
loyaltyPolicyRouter.get('/', getLoyaltyPolicy);
loyaltyPolicyRouter.post('/', updateLoyaltyPolicy);
