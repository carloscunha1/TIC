import type { User } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
}

export class PrismaUserRepository implements UserRepository {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }
}
