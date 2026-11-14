import type { User, UserRole, UserStatus, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
}

export interface UserCreationRepository extends UserRepository {
  create(input: { name: string; email: string; passwordHash: string; role: UserRole }): Promise<User>;
}

export type UserListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
};

export type UserListResult = {
  users: User[];
  total: number;
};

export interface UserQueryRepository extends UserRepository {
  list(filters: UserListFilters): Promise<UserListResult>;
}

export class PrismaUserRepository implements UserCreationRepository, UserQueryRepository {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  create(input: { name: string; email: string; passwordHash: string; role: UserRole }): Promise<User> {
    return prisma.user.create({ data: input });
  }

  async list(filters: UserListFilters): Promise<UserListResult> {
    const where: Prisma.UserWhereInput = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        where,
      }),
      prisma.user.count({ where }),
    ]);
    return { total, users };
  }
}
