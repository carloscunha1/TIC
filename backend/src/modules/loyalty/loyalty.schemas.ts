import { z } from 'zod';

const sourceType = z.string().trim().min(1).max(40).regex(/^[A-Z][A-Z0-9_]*$/);
const sourceId = z.string().trim().min(1).max(100);
const customerId = z.string().uuid();
const points = z.number().int().min(1).max(2_147_483_647);
const positiveMoney = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Informe um valor positivo com até duas casas decimais.').refine((value) => Number(value) > 0, 'O valor deve ser positivo.');

export const awardPointsSchema = z.object({ customerId, sourceType, sourceId, eligibleAmount: positiveMoney, actorUserId: z.string().uuid().optional() }).strict();
export const redeemPointsSchema = z.object({ customerId, sourceType, sourceId, points, actorUserId: z.string().uuid().optional() }).strict();
export const reverseAwardSchema = z.object({ customerId, sourceType, sourceId, creditId: z.string().uuid(), points: points.optional(), actorUserId: z.string().uuid().optional() }).strict();
export const reverseRedemptionSchema = z.object({ customerId, sourceType, sourceId, movementId: z.string().uuid(), points: points.optional(), actorUserId: z.string().uuid().optional() }).strict();
export const customerBalanceParamsSchema = z.object({ customerId }).strict();
export type AwardPointsInput = z.infer<typeof awardPointsSchema>;
export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;
export type ReverseAwardInput = z.infer<typeof reverseAwardSchema>;
export type ReverseRedemptionInput = z.infer<typeof reverseRedemptionSchema>;
