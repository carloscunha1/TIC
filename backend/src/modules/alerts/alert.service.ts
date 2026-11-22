import { randomUUID } from 'node:crypto';
import { AlertPriority, AlertStatus, AlertType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { AlertListQuery } from './alert.schemas.js';

type Candidate = {
  type: AlertType;
  priority: AlertPriority;
  eventKey: string;
  title: string;
  message: string;
  productId?: string;
  lotId?: string;
  customerId?: string;
};

function localToday(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return new Date(Date.UTC(Number(parts.find((part) => part.type === 'year')?.value), Number(parts.find((part) => part.type === 'month')?.value) - 1, Number(parts.find((part) => part.type === 'day')?.value)));
}

export class AlertService {
  async generate(): Promise<number> {
    return prisma.$transaction(async (transaction) => {
      const today = localToday();
      const candidates: Candidate[] = [];
      const products = await transaction.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, minimumStock: true, expirationAlertDays: true, stockMode: true, stockBalance: { select: { quantity: true } }, stockLots: { select: { id: true, identifier: true, expirationDate: true, currentQuantity: true } } },
      });
      for (const product of products) {
        const available = product.stockMode === 'SIMPLES'
          ? product.stockBalance?.quantity ?? new Prisma.Decimal(0)
          : product.stockLots.filter((lot) => lot.currentQuantity.gt(0) && (!lot.expirationDate || lot.expirationDate >= today)).reduce((sum, lot) => sum.add(lot.currentQuantity), new Prisma.Decimal(0));
        if (available.isZero()) {
          candidates.push({ type: AlertType.ESTOQUE_ZERADO, priority: AlertPriority.ALTA, eventKey: `PRODUCT_ZERO:${product.id}`, title: 'Estoque zerado', message: `${product.name} está sem estoque disponível.`, productId: product.id });
        } else if (product.minimumStock.gt(0) && available.lessThanOrEqualTo(product.minimumStock)) {
          candidates.push({ type: AlertType.ESTOQUE_ABAIXO_MINIMO, priority: AlertPriority.MEDIA, eventKey: `PRODUCT_LOW:${product.id}`, title: 'Estoque abaixo do mínimo', message: `${product.name} está com ${available.toString()} unidades disponíveis.`, productId: product.id });
        }
        if (product.stockMode === 'LOTE') {
          for (const lot of product.stockLots) {
            if (lot.currentQuantity.isZero() || !lot.expirationDate) continue;
            const days = (lot.expirationDate.getTime() - today.getTime()) / 86_400_000;
            if (days <= 0) candidates.push({ type: AlertType.LOTE_VENCIDO, priority: AlertPriority.ALTA, eventKey: `LOT_EXPIRED:${lot.id}`, title: 'Lote vencido', message: `${product.name} · lote ${lot.identifier} está vencido e possui saldo.`, productId: product.id, lotId: lot.id });
            else if (days <= product.expirationAlertDays) candidates.push({ type: AlertType.LOTE_PROXIMO_VENCIMENTO, priority: AlertPriority.MEDIA, eventKey: `LOT_EXPIRING:${lot.id}`, title: 'Lote próximo do vencimento', message: `${product.name} · lote ${lot.identifier} vence em ${Math.ceil(days)} dia(s).`, productId: product.id, lotId: lot.id });
          }
        }
      }
      const negativeCustomers = await transaction.loyaltyMovement.groupBy({ by: ['customerId'], _sum: { pointsDelta: true } });
      for (const customer of negativeCustomers) {
        if ((customer._sum.pointsDelta ?? 0) < 0) candidates.push({ type: AlertType.SALDO_FIDELIDADE_NEGATIVO, priority: AlertPriority.BAIXA, eventKey: `CUSTOMER_NEGATIVE:${customer.customerId}`, title: 'Saldo de fidelidade negativo', message: 'Cliente possui saldo negativo de pontos.', customerId: customer.customerId });
      }

      const active = await transaction.operationalAlert.findMany({ where: { status: AlertStatus.ATIVO }, select: { id: true, eventKey: true } });
      const candidateKeys = new Set(candidates.map((candidate) => candidate.eventKey));
      for (const alert of active) {
        if (!candidateKeys.has(alert.eventKey)) await transaction.operationalAlert.update({ where: { id: alert.id }, data: { status: AlertStatus.RESOLVIDO, resolvedAt: new Date() } });
      }
      let created = 0;
      for (const candidate of candidates) {
        const current = active.find((alert) => alert.eventKey === candidate.eventKey);
        if (current) continue;
        await transaction.operationalAlert.create({ data: { id: randomUUID(), ...candidate } });
        created += 1;
      }
      return created;
    });
  }

  async list(query: AlertListQuery, userId: string) {
    await this.generate();
    const where: Prisma.OperationalAlertWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
    };
    const [alerts, total] = await prisma.$transaction([
      prisma.operationalAlert.findMany({ where, include: { product: { select: { name: true } }, lot: { select: { identifier: true } }, customer: { select: { name: true } }, reads: { where: { userId }, select: { id: true } } }, orderBy: [{ status: 'asc' }, { priority: 'asc' }, { detectedAt: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      prisma.operationalAlert.count({ where }),
    ]);
    return { alerts: alerts.map((alert) => ({ ...alert, isRead: alert.reads.length > 0, reads: undefined })), total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
  }

  async markRead(id: string, userId: string) {
    const alert = await prisma.operationalAlert.findUnique({ where: { id } });
    if (!alert) throw new Error('ALERT_NOT_FOUND');
    await prisma.alertRead.upsert({ where: { alertId_userId: { alertId: id, userId } }, create: { id: randomUUID(), alertId: id, userId }, update: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    const alerts = await prisma.operationalAlert.findMany({ select: { id: true } });
    await prisma.$transaction(alerts.map((alert) => prisma.alertRead.upsert({ where: { alertId_userId: { alertId: alert.id, userId } }, create: { id: randomUUID(), alertId: alert.id, userId }, update: { readAt: new Date() } })));
  }
}
