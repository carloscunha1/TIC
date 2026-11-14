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
  findById(id: string): Promise<User | null>;
  list(filters: UserListFilters): Promise<UserListResult>;
}

export interface UserUpdateRepository extends UserQueryRepository {
  update(id: string, input: { name: string; role: UserRole }): Promise<User>;
  updateStatus(id: string, status: UserStatus): Promise<User>;
}

export class LastActiveAdminError extends Error {
  constructor() {
    super('The last active administrator cannot be deactivated.');
    this.name = 'LastActiveAdminError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found.');
    this.name = 'UserNotFoundError';
  }
}

export class PrismaUserRepository implements UserCreationRepository, UserUpdateRepository {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  create(input: { name: string; email: string; passwordHash: string; role: UserRole }): Promise<User> {
    return prisma.user.create({ data: input });
  }

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  update(id: string, input: { name: string; role: UserRole }): Promise<User> {
    return prisma.user.update({ where: { id }, data: input });
  }

  updateStatus(id: string, status: UserStatus): Promise<User> {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id } });
      if (!user) throw new UserNotFoundError();
      if (status === 'INACTIVE' && user.role === 'ADMIN' && user.status === 'ACTIVE') {
        const activeAdministrators = await transaction.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
        if (activeAdministrators <= 1) throw new LastActiveAdminError();
      }
      return transaction.user.update({ where: { id }, data: { status } });
    });
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
