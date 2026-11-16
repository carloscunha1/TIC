import { ApiError } from '../../shared/http/api-error.js';
import { hashToken } from './customer-auth.service.js';
import type { CustomerSessionRepository } from './customer-session.repository.js';
const IDLE_MS = 5 * 60 * 1000;
export class CustomerSessionService {
  constructor(private readonly repository: CustomerSessionRepository, private readonly now = () => new Date()) {}
  async authenticate(token: string) {
    const session = await this.repository.find(hashToken(token));
    const now = this.now();
    if (!session || session.revokedAt || session.expiresAt <= now || session.lastActivityAt.getTime() + IDLE_MS <= now.getTime() || session.customer.status !== 'ACTIVE') {
      if (session && !session.revokedAt) await this.repository.revoke(session.tokenHash, now);
      throw new ApiError(401, 'INVALID_CUSTOMER_SESSION', 'Sessão inválida ou expirada.');
    }
    const expiresAt = new Date(now.getTime() + IDLE_MS);
    await this.repository.renew(session.id, expiresAt, now);
    return { customerId: session.customer.id, name: session.customer.name, expiresAt };
  }
  async logout(token?: string) { if (token) await this.repository.revoke(hashToken(token), this.now()); }
}
