import { Prisma, type UserStatus } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { LastActiveAdminError, UserNotFoundError, type UserUpdateRepository } from '../auth/user.repository.js';
import type { PublicUser } from './user.service.js';

export class UserStatusService {
  constructor(private readonly userRepository: UserUpdateRepository) {}

  async update(id: string, status: UserStatus): Promise<PublicUser> {
    try {
      return toPublicUser(await this.userRepository.updateStatus(id, status));
    } catch (error) {
      if (error instanceof LastActiveAdminError) {
        throw new ApiError(409, 'LAST_ACTIVE_ADMIN', 'Não é possível inativar o último Administrador ativo.');
      }
      if (error instanceof UserNotFoundError) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
      }
      throw error;
    }
  }
}

function toPublicUser(user: Awaited<ReturnType<UserUpdateRepository['updateStatus']>>): PublicUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}
