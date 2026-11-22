import { ApiError } from '../../shared/http/api-error.js';
import type { EstablishmentSettingsRepository } from './settings.repository.js';
import { establishmentSettingsSchema, type EstablishmentSettingsInput } from './settings.schemas.js';

export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCnpj(value: string): boolean {
  if (value.length !== 14 || /^([0-9])\1+$/.test(value)) return false;
  const digits = [...value].map(Number);
  const calculate = (weights: number[], offset: number): number => {
    const sum = weights.reduce((total, weight, index) => total + digits[offset + index] * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 0) === digits[12]
    && calculate([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], 0) === digits[13];
}

export class EstablishmentSettingsService {
  constructor(private readonly repository: EstablishmentSettingsRepository) {}

  async get() {
    const settings = await this.repository.get();
    return settings ?? {
      id: null,
      name: 'Conveniência do Posto Paulo VI',
      cnpj: null,
      phone: null,
      address: null,
    };
  }

  async update(input: EstablishmentSettingsInput, actorUserId: string, ipAddress?: string) {
    const values = establishmentSettingsSchema.parse(input);
    const cnpj = values.cnpj ? normalizeDigits(values.cnpj) : null;
    if (cnpj && !isValidCnpj(cnpj)) throw new ApiError(400, 'INVALID_CNPJ', 'CNPJ inválido.');
    const phone = values.phone ? normalizeDigits(values.phone) : null;
    if (phone && (phone.length < 10 || phone.length > 11)) throw new ApiError(400, 'INVALID_PHONE', 'Telefone inválido.');
    return this.repository.upsert({
      name: values.name,
      cnpj,
      phone,
      address: values.address || null,
      actorUserId,
      ipAddress,
    });
  }
}
