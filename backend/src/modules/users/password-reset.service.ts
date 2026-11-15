import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../shared/http/api-error.js';
import type { PasswordResetRepository } from '../auth/user.repository.js';

const RESET_TOKEN_DURATION_MS = 30 * 60 * 1000;

export class PasswordResetService {
  constructor(private readonly userRepository: PasswordResetRepository) {}

  async issue(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION_MS);
    await this.userRepository.createPasswordReset(user.id, { expiresAt, tokenHash: hashToken(token) });
    return { expiresAt, token };
  }

  async complete(token: string, password: string): Promise<void> {
    try {
      await this.userRepository.completePasswordReset(hashToken(token), await bcrypt.hash(password, 12), new Date());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, 'INVALID_RESET_TOKEN', 'A credencial temporária é inválida ou expirou.');
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
