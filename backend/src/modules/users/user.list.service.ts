import type { UserRole, UserStatus } from '@prisma/client';
import type { UserListResult, UserQueryRepository } from '../auth/user.repository.js';
import type { ListUsersQuery } from './user.list.schemas.js';
import type { PublicUser } from './user.service.js';

export type UserListResponse = {
  users: PublicUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export class UserListService {
  constructor(private readonly userRepository: UserQueryRepository) {}

  async list(query: ListUsersQuery): Promise<UserListResponse> {
    const result = await this.userRepository.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search || undefined,
      role: query.role as UserRole | undefined,
      status: query.status as UserStatus | undefined,
    });
    return toResponse(result, query.page, query.pageSize);
  }
}

function toResponse(result: UserListResult, page: number, pageSize: number): UserListResponse {
  return {
    page,
    pageSize,
    total: result.total,
    totalPages: Math.ceil(result.total / pageSize),
    users: result.users.map(({ createdAt, email, id, name, role, status }) => ({
      createdAt,
      email,
      id,
      name,
      role,
      status,
    })),
  };
}
