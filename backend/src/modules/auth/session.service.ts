import { createHash } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { ApiError } from '../../shared/http/api-error.js';
import type { SessionRepository } from './session.repository.js';
import type { UserRole } from '@prisma/client';

const INACTIVITY_SECONDS = 30 * 60;

type SessionServiceDependencies = {
  sessionRepository: SessionRepository;
  jwtSecret: string;
};

export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
  sessionToken: string;
};

type SessionClaims = JwtPayload & { sid: string; sub: string };

export class SessionService {
  constructor(private readonly dependencies: SessionServiceDependencies) {}

  async authenticate(token: string): Promise<AuthenticatedSession> {
    const claims = this.verifyToken(token);
    const session = await this.dependencies.sessionRepository.findById(claims.sid);
    const now = new Date();

    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      now.getTime() - session.lastActivityAt.getTime() >= INACTIVITY_SECONDS * 1000 ||
      session.user.status !== 'ACTIVE' ||
      session.tokenHash !== hashToken(token)
    ) {
      if (session) await this.dependencies.sessionRepository.revoke(session.id, now);
      throw new ApiError(401, 'INVALID_SESSION', 'Sessão inválida ou expirada.');
    }

    const expiresAt = new Date(now.getTime() + INACTIVITY_SECONDS * 1000);
    await this.dependencies.sessionRepository.renew(session.id, {
      expiresAt,
      lastActivityAt: now,
    });

    return {
      email: session.user.email,
      expiresAt,
      name: session.user.name,
      sessionToken: token,
      role: session.user.role,
      sessionId: session.id,
      userId: session.userId,
    };
  }

  async logout(token: string | null): Promise<void> {
    if (!token) return;
    try {
      const claims = this.verifyToken(token);
      await this.dependencies.sessionRepository.revoke(claims.sid, new Date());
    } catch {
      // Logout remains idempotent even when the submitted token is invalid.
    }
  }

  private verifyToken(token: string): SessionClaims {
    try {
      const claims = jwt.verify(token, this.dependencies.jwtSecret);
      if (typeof claims === 'string' || !claims.sid || !claims.sub) throw new Error('Invalid claims');
      return claims as SessionClaims;
    } catch {
      throw new ApiError(401, 'INVALID_SESSION', 'Sessão inválida ou expirada.');
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
