import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../shared/http/api-error.js';
import type { CreateUserInput } from './user.schemas.js';
import type { UserCreationRepository } from '../auth/user.repository.js';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
};

export class UserService {
  constructor(private readonly userRepository: UserCreationRepository) {}

  async create(input: CreateUserInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Já existe um usuário com este e-mail.');

    try {
      const user = await this.userRepository.create({
        email,
        name: input.name.trim(),
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.role,
      });
      return toPublicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Já existe um usuário com este e-mail.');
      }
      throw error;
    }
  }
}

function toPublicUser(user: Awaited<ReturnType<UserCreationRepository['create']>>): PublicUser {
  return {
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}
