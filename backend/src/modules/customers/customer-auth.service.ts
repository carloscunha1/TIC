import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../shared/http/api-error.js';
import type { CustomerAuthRepository } from './customer-auth.repository.js';
import { completeCustomerPinSetupSchema, customerLoginSchema, type CompleteCustomerPinSetupInput, type CustomerLoginInput } from './customer-auth.schemas.js';

const PIN_SETUP_TTL_MS = 15 * 60 * 1000;
const CUSTOMER_SESSION_TTL_MS = 5 * 60 * 1000;
const PIN_LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_PIN_FAILURES = 5;
const PIN_HASH_ROUNDS = 12;
const INVALID_CREDENTIALS = new ApiError(401, 'INVALID_CUSTOMER_CREDENTIALS', 'Telefone ou PIN inválidos.');

type CustomerAuthServiceOptions = {
  hashPin?: (pin: string) => Promise<string>;
  comparePin?: (pin: string, hash: string) => Promise<boolean>;
  now?: () => Date;
  createToken?: () => string;
};

export class CustomerAuthService {
  private readonly hashPin: (pin: string) => Promise<string>;
  private readonly comparePin: (pin: string, hash: string) => Promise<boolean>;
  private readonly now: () => Date;
  private readonly createToken: () => string;
  private readonly dummyPinHash: Promise<string>;

  constructor(private readonly repository: CustomerAuthRepository, options: CustomerAuthServiceOptions = {}) {
    this.hashPin = options.hashPin ?? ((pin) => bcrypt.hash(pin, PIN_HASH_ROUNDS));
    this.comparePin = options.comparePin ?? ((pin, hash) => bcrypt.compare(pin, hash));
    this.now = options.now ?? (() => new Date());
    this.createToken = options.createToken ?? (() => randomBytes(32).toString('base64url'));
    this.dummyPinHash = this.hashPin(randomBytes(32).toString('hex'));
  }

  async startPinSetup(customerId: string, actorUserId: string, ipAddress?: string) {
    const token = this.createToken();
    const expiresAt = new Date(this.now().getTime() + PIN_SETUP_TTL_MS);
    try {
      await this.repository.requestPinSetup(customerId, hashToken(token), expiresAt, actorUserId, ipAddress);
      const setupUrl = new URL('/fidelidade/definir-pin', process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173');
      setupUrl.hash = new URLSearchParams({ token }).toString();
      return { setupUrl: setupUrl.toString(), expiresAt };
    } catch (error) {
      if (error instanceof Error && error.message === 'CUSTOMER_NOT_FOUND') throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
      if (error instanceof Error && error.message === 'CUSTOMER_INACTIVE') throw new ApiError(409, 'CUSTOMER_INACTIVE', 'Não é possível definir PIN para um cliente inativo.');
      throw error;
    }
  }

  async completePinSetup(input: CompleteCustomerPinSetupInput): Promise<void> {
    const { token, pin } = completeCustomerPinSetupSchema.parse(input);
    try {
      await this.repository.completePinSetup(hashToken(token), await this.hashPin(pin), this.now());
    } catch (error) {
      if (error instanceof Error && error.message === 'PIN_SETUP_LINK_INVALID') {
        throw new ApiError(400, 'PIN_SETUP_LINK_INVALID', 'O link de definição expirou ou já foi utilizado.');
      }
      throw error;
    }
  }

  async login(input: CustomerLoginInput, ipAddress?: string): Promise<{ sessionToken: string; customerId: string; expiresAt: Date }> {
    const { phone: suppliedPhone, pin } = customerLoginSchema.parse(input);
    const phone = suppliedPhone.replace(/\D/g, '');
    if (!phone) {
      await this.comparePin(pin, await this.dummyPinHash);
      throw INVALID_CREDENTIALS;
    }

    const result = await this.repository.withLockedCustomerByPhone(phone, async (customer, unit) => {
      if (!customer || customer.status !== 'ACTIVE' || !customer.pinHash) {
        await this.comparePin(pin, await this.dummyPinHash);
        await unit.recordRejected(customer?.id, ipAddress);
        return null;
      }
      const now = this.now();
      if (customer.pinLockedUntil && customer.pinLockedUntil > now) {
        await this.comparePin(pin, await this.dummyPinHash);
        await unit.recordRejected(customer.id, ipAddress);
        return null;
      }

      const matches = await this.comparePin(pin, customer.pinHash);
      if (!matches) {
        const attempts = customer.pinLockedUntil && customer.pinLockedUntil <= now ? 1 : customer.pinFailedAttempts + 1;
        const lockedUntil = attempts >= MAX_PIN_FAILURES ? new Date(now.getTime() + PIN_LOCK_DURATION_MS) : null;
        await unit.recordFailure(customer.id, attempts, lockedUntil, ipAddress);
        return null;
      }

      await unit.resetFailures(customer.id);
      const sessionToken = this.createToken();
      const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_TTL_MS);
      await unit.createSession({ id: randomUUID(), customerId: customer.id, tokenHash: hashToken(sessionToken), expiresAt }, ipAddress);
      return { sessionToken, customerId: customer.id, expiresAt };
    });

    if (!result) throw INVALID_CREDENTIALS;
    return result;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
