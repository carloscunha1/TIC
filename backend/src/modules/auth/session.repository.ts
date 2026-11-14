import type { Session } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export interface SessionRepository {
  create(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<Session>;
}

export class PrismaSessionRepository implements SessionRepository {
  create(input: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<Session> {
    return prisma.session.create({ data: input });
  }
}
