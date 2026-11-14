import { Prisma } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import type { UserUpdateRepository } from '../auth/user.repository.js';
import type { UpdateUserInput } from './user.update.schemas.js';
import type { PublicUser } from './user.service.js';

export class UserUpdateService {
  constructor(private readonly userRepository: UserUpdateRepository) {}

  async findById(id: string): Promise<PublicUser> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    return toPublicUser(user);
  }

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    try {
      const user = await this.userRepository.update(id, {
        name: input.name.trim(),
        role: input.role as UserRole,
      });
      return toPublicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
      }
      throw error;
    }
  }
}

function toPublicUser(user: Awaited<ReturnType<UserUpdateRepository['update']>>): PublicUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}
