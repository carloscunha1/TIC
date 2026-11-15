import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError } from '../../shared/http/api-error.js';
import type { LoginInput } from './auth.schemas.js';
import type { SessionRepository } from './session.repository.js';
import type { UserRepository } from './user.repository.js';

const SESSION_DURATION_SECONDS = 30 * 60;
const SESSION_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const DUMMY_PASSWORD = randomBytes(32).toString('hex');
const dummyPasswordHashPromise = bcrypt.hash(DUMMY_PASSWORD, 12);

type AuthServiceDependencies = {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  jwtSecret: string;
};

export type LoginResult = {
  token: string;
  expiresAt: Date;
};

export class AuthService {
  constructor(private readonly dependencies: AuthServiceDependencies) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.dependencies.userRepository.findByEmail(input.email);
    const passwordHash = user?.passwordHash ?? await dummyPasswordHashPromise;
    const passwordMatches = await bcrypt.compare(input.password, passwordHash);

    if (!user || user.status !== 'ACTIVE' || !passwordMatches) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }
    if (user.mustChangePassword) {
      throw new ApiError(403, 'PASSWORD_RESET_REQUIRED', 'É necessário definir uma nova senha antes de entrar.');
    }

    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
    const sessionId = randomUUID();
    const token = jwt.sign({ sid: sessionId, sub: user.id }, this.dependencies.jwtSecret, {
      expiresIn: SESSION_TOKEN_MAX_AGE_SECONDS,
    });

    await this.dependencies.sessionRepository.create({
      id: sessionId,
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt,
    });

    return { token, expiresAt };
  }
}
