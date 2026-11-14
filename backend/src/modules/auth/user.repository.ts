import type { User, UserRole } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
}

export interface UserCreationRepository extends UserRepository {
  create(input: { name: string; email: string; passwordHash: string; role: UserRole }): Promise<User>;
}

export class PrismaUserRepository implements UserCreationRepository {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  create(input: { name: string; email: string; passwordHash: string; role: UserRole }): Promise<User> {
    return prisma.user.create({ data: input });
  }
}
