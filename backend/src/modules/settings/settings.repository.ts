import type { EstablishmentSettings } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AuditService } from '../audit/audit.service.js';

export interface EstablishmentSettingsRepository {
  get(): Promise<EstablishmentSettings | null>;
  upsert(input: { name: string; cnpj: string | null; phone: string | null; address: string | null; actorUserId: string; ipAddress?: string }): Promise<EstablishmentSettings>;
}

export class PrismaEstablishmentSettingsRepository implements EstablishmentSettingsRepository {
  constructor(private readonly auditService: AuditService) {}

  get(): Promise<EstablishmentSettings | null> {
    return prisma.establishmentSettings.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  upsert(input: { name: string; cnpj: string | null; phone: string | null; address: string | null; actorUserId: string; ipAddress?: string }): Promise<EstablishmentSettings> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.establishmentSettings.findFirst({ orderBy: { createdAt: 'asc' } });
      const result = before
        ? await tx.establishmentSettings.update({ where: { id: before.id }, data: { name: input.name, cnpj: input.cnpj, phone: input.phone, address: input.address } })
        : await tx.establishmentSettings.create({ data: { name: input.name, cnpj: input.cnpj, phone: input.phone, address: input.address } });
      await this.auditService.record({
        actor: { type: 'USER', userId: input.actorUserId },
        action: before ? 'ESTABLISHMENT_SETTINGS_UPDATED' : 'ESTABLISHMENT_SETTINGS_CREATED',
        entity: 'EstablishmentSettings',
        entityId: result.id,
        before: before ? { name: before.name, cnpj: before.cnpj, phone: before.phone, address: before.address } : null,
        after: { name: result.name, cnpj: result.cnpj, phone: result.phone, address: result.address },
        ipAddress: input.ipAddress,
      }, tx);
      return result;
    });
  }
}
