import type { CustomerSession } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export type CustomerSessionWithCustomer = CustomerSession & { customer: { id: string; name: string; status: string } };
export interface CustomerSessionRepository {
  find(tokenHash: string): Promise<CustomerSessionWithCustomer | null>;
  renew(id: string, expiresAt: Date, lastActivityAt: Date): Promise<void>;
  revoke(tokenHash: string, at: Date): Promise<void>;
}
export class PrismaCustomerSessionRepository implements CustomerSessionRepository {
  find(tokenHash: string) { return prisma.customerSession.findUnique({ where: { tokenHash }, include: { customer: { select: { id: true, name: true, status: true } } } }); }
  async renew(id: string, expiresAt: Date, lastActivityAt: Date) { await prisma.customerSession.update({ where: { id }, data: { expiresAt, lastActivityAt } }); }
  async revoke(tokenHash: string, at: Date) { await prisma.customerSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: at } }); }
}
