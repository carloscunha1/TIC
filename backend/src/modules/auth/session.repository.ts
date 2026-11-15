import type { Session, User } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export interface SessionRepository {
  create(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<Session>;
  findById(id: string): Promise<(Session & { user: User }) | null>;
  revoke(id: string, revokedAt: Date): Promise<void>;
  renew(id: string, input: { lastActivityAt: Date; expiresAt: Date }): Promise<void>;
}

export class PrismaSessionRepository implements SessionRepository {
  create(input: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<Session> {
    return prisma.session.create({ data: input });
  }

  findById(id: string): Promise<(Session & { user: User }) | null> {
    return prisma.session.findUnique({ where: { id }, include: { user: true } });
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt } });
  }

  async renew(id: string, input: { lastActivityAt: Date; expiresAt: Date }): Promise<void> {
    await prisma.session.update({ where: { id }, data: input });
  }
}
