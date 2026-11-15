import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import type { EntryCancellationRepository } from './entry-cancellation.repository.js';

export class EntryCancellationService {
  constructor(private readonly repository: EntryCancellationRepository) {}

  cancel(id: string, justification: string, actorUserId: string, ipAddress?: string) {
    return this.repository.transaction(async (transaction) => {
      const entry = await transaction.lockEntry(id);
      if (!entry) throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Entrada não encontrada.');
      if (entry.status !== 'CONFIRMADA') throw new ApiError(409, 'ENTRY_NOT_CANCELLABLE', 'Somente entradas confirmadas podem ser canceladas.');

      await transaction.lockProducts([...new Set(entry.items.map((item) => item.productId))]);
      const movements = await transaction.getEntryMovements(id);
      const blockers: Array<{ product: string; quantity: string; reason: string }> = [];
      const productTotals = new Map<string, Prisma.Decimal>();
      const lotTotals = new Map<string, { productId: string; name: string; identifier: string; expirationDate: Date | null; quantity: Prisma.Decimal }>();

      for (const item of entry.items) {
        const quantity = new Prisma.Decimal(item.quantity);
        if (item.product.stockMode === 'SIMPLES') {
          productTotals.set(item.productId, (productTotals.get(item.productId) ?? new Prisma.Decimal(0)).plus(quantity));
        } else if (!item.lotIdentifier) {
          blockers.push({ product: item.product.name, quantity: quantity.toString(), reason: 'Identificação do lote não consta na entrada.' });
        } else {
          const key = `${item.productId}:${item.lotIdentifier}:${item.expirationDate?.toISOString() ?? ''}`;
          const existing = lotTotals.get(key);
          lotTotals.set(key, { productId: item.productId, name: item.product.name, identifier: item.lotIdentifier, expirationDate: item.expirationDate, quantity: (existing?.quantity ?? new Prisma.Decimal(0)).plus(quantity) });
        }
      }

      for (const [productId, quantity] of productTotals) {
        const product = entry.items.find((item) => item.productId === productId)?.product;
        const receiptQuantity = movements.filter((movement) => movement.productId === productId && !movement.lotId).reduce((sum, movement) => sum.plus(movement.quantity), new Prisma.Decimal(0));
        const balance = await transaction.getSimpleBalance(productId);
        if (!receiptQuantity.equals(quantity)) blockers.push({ product: product?.name ?? productId, quantity: quantity.toString(), reason: 'Não foi possível localizar o movimento original completo da entrada.' });
        if (!balance || balance.quantity.lessThan(quantity)) blockers.push({ product: product?.name ?? productId, quantity: quantity.toString(), reason: `Saldo atual (${balance?.quantity.toString() ?? '0'}) insuficiente para estorno.` });
      }

      const lotSnapshots: Array<{ lotId: string; productId: string; name: string; quantity: Prisma.Decimal }> = [];
      for (const lot of lotTotals.values()) {
        const stockLot = await transaction.getLot(lot.productId, lot.identifier, lot.expirationDate);
        const matchedMovements = stockLot ? movements.filter((movement) => movement.productId === lot.productId && movement.lotId === stockLot.id) : [];
        const receiptQuantity = matchedMovements.reduce((sum, movement) => sum.plus(movement.quantity), new Prisma.Decimal(0));
        if (!receiptQuantity.equals(lot.quantity)) blockers.push({ product: `${lot.name} (lote ${lot.identifier})`, quantity: lot.quantity.toString(), reason: 'Não foi possível localizar o movimento original completo do lote.' });
        if (!stockLot || !stockLot.currentQuantity.equals(stockLot.initialQuantity) || stockLot.currentQuantity.lessThan(lot.quantity)) {
          blockers.push({ product: `${lot.name} (lote ${lot.identifier})`, quantity: lot.quantity.toString(), reason: 'O lote não mantém integralmente a quantidade original recebida.' });
        }
        const latestReceipt = matchedMovements.at(-1);
        if (stockLot && latestReceipt) {
          const lotMovements = await transaction.getLotMovements(stockLot.id);
          const receiptPosition = lotMovements.findIndex((movement) => movement.id === latestReceipt.id);
          if (receiptPosition < 0 || lotMovements.slice(receiptPosition + 1).length > 0) blockers.push({ product: `${lot.name} (lote ${lot.identifier})`, quantity: lot.quantity.toString(), reason: 'O lote possui movimentação posterior à entrada.' });
          else lotSnapshots.push({ lotId: stockLot.id, productId: lot.productId, name: lot.name, quantity: lot.quantity });
        }
      }

      if (blockers.length > 0) {
        const summary = blockers.map((blocker) => `${blocker.product}: ${blocker.reason}`).join(' ');
        throw new ApiError(409, 'ENTRY_CANCELLATION_BLOCKED', `A entrada não pode ser cancelada. ${summary}`, { blockers });
      }

      const reversals: Array<{ productId: string; lotId: string | null; quantity: string }> = [];
      for (const [productId, quantity] of productTotals) {
        await transaction.changeSimpleBalance(productId, quantity);
        await transaction.createReversal({ productId, quantity, actorUserId, reason: this.reversalReason(id, justification) });
        reversals.push({ productId, lotId: null, quantity: quantity.toString() });
      }
      for (const lot of lotSnapshots) {
        await transaction.changeLot(lot.lotId, lot.quantity);
        await transaction.createReversal({ productId: lot.productId, lotId: lot.lotId, quantity: lot.quantity, actorUserId, reason: this.reversalReason(id, justification) });
        reversals.push({ productId: lot.productId, lotId: lot.lotId, quantity: lot.quantity.toString() });
      }

      if (!await transaction.markCanceled(id)) throw new ApiError(409, 'ENTRY_NOT_CANCELLABLE', 'A entrada deixou de estar confirmada.');
      const canceledEntry = await transaction.findEntry(id);
      await transaction.audit({ actorUserId, entryId: id, ipAddress, justification, reversals });
      return { entry: canceledEntry, reversals };
    });
  }

  private reversalReason(entryId: string, justification: string): string {
    return `Cancelamento da entrada ${entryId}: ${justification}`.slice(0, 300);
  }
}
