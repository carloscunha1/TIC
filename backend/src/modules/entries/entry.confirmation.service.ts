import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import type { ConfirmationProduct, EntryConfirmationRepository } from './entry-confirmation.repository.js';

export class EntryConfirmationService {
  constructor(private readonly repository: EntryConfirmationRepository) {}

  confirm(id: string, actorUserId: string, ipAddress?: string) {
    return this.repository.transaction(async (transaction) => {
      const entry = await transaction.lockEntry(id);
      if (!entry) throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Entrada não encontrada.');
      if (entry.status === 'CONFIRMADA') return { entry: await transaction.findEntry(id), alreadyConfirmed: true };
      if (entry.status !== 'EM_ANDAMENTO') throw new ApiError(409, 'ENTRY_NOT_CONFIRMABLE', 'Somente entradas em andamento podem ser confirmadas.');
      if (entry.items.length === 0) throw new ApiError(409, 'ENTRY_EMPTY', 'Adicione ao menos um item antes de confirmar a entrada.');

      if (entry.supplierId) {
        const supplier = await transaction.lockSupplier(entry.supplierId);
        if (!supplier || supplier.status !== 'ACTIVE') throw new ApiError(409, 'SUPPLIER_INACTIVE', 'O fornecedor está inativo e a entrada não pode ser confirmada.');
      }

      const productIds = [...new Set(entry.items.map((item) => item.productId))];
      const products = await transaction.lockProducts(productIds);
      if (products.length !== productIds.length) throw new ApiError(409, 'PRODUCT_NOT_FOUND', 'Um ou mais produtos da entrada não existem.');
      const productById = new Map(products.map((product) => [product.id, product]));
      const lastSimpleCost = new Map<string, Prisma.Decimal>();
      const movementSummaries: Array<{ productId: string; lotId: string | null; quantity: string }> = [];

      for (const item of entry.items) {
        const product = productById.get(item.productId);
        if (!product) throw new ApiError(409, 'PRODUCT_NOT_FOUND', 'Um ou mais produtos da entrada não existem.');
        this.validateItem(product, item.quantity, item.lotIdentifier, item.expirationDate);
        const quantity = new Prisma.Decimal(item.quantity);
        let lotId: string | undefined;

        if (product.stockMode === 'SIMPLES') {
          await transaction.increaseSimpleBalance(product.id, quantity);
          lastSimpleCost.set(product.id, new Prisma.Decimal(item.unitCost));
        } else {
          const identifier = item.lotIdentifier;
          if (!identifier) throw new ApiError(409, 'LOT_REQUIRED', 'Informe a identificação do lote para confirmar a entrada.');
          const expirationDate = item.expirationDate;
          const lot = await transaction.findLot({ productId: product.id, identifier, expirationDate });
          const unitCost = new Prisma.Decimal(item.unitCost);
          const savedLot = lot
            ? await transaction.addToLot(lot.id, quantity, unitCost)
            : await transaction.createLot({ productId: product.id, identifier, expirationDate, unitCost, quantity });
          lotId = savedLot.id;
        }

        await transaction.createMovement({ productId: product.id, ...(lotId ? { lotId } : {}), quantity, actorUserId, reason: `Confirmação da entrada ${id}` });
        movementSummaries.push({ productId: product.id, lotId: lotId ?? null, quantity: quantity.toString() });
      }

      for (const [productId, unitCost] of lastSimpleCost) {
        const product = productById.get(productId) as ConfirmationProduct;
        await transaction.updateSimpleProductCost(productId, product.cost, unitCost, actorUserId, id);
      }

      if (!await transaction.markConfirmed(id)) throw new ApiError(409, 'ENTRY_NOT_CONFIRMABLE', 'A entrada deixou de estar em andamento.');
      const confirmedEntry = await transaction.findEntry(id);
      await transaction.audit({
        actorUserId,
        entryId: id,
        ipAddress,
        before: { status: entry.status, supplierId: entry.supplierId, itemCount: entry.items.length },
        after: { status: confirmedEntry.status, movements: movementSummaries },
      });
      return { entry: confirmedEntry, alreadyConfirmed: false };
    });
  }

  private validateItem(product: ConfirmationProduct, quantity: Prisma.Decimal, lotIdentifier: string | null, expirationDate: Date | null): void {
    if (product.status !== 'ACTIVE') throw new ApiError(409, 'PRODUCT_INACTIVE', `O produto ${product.name} está inativo e não pode receber uma entrada comum.`);
    if (product.unit === 'UN' && !quantity.isInteger()) throw new ApiError(409, 'INVALID_UNIT_QUANTITY', `O produto ${product.name} aceita apenas quantidades inteiras.`);
    if (product.stockMode === 'LOTE' && !lotIdentifier) throw new ApiError(409, 'LOT_REQUIRED', `Informe a identificação do lote do produto ${product.name}.`);
    if (product.stockMode === 'SIMPLES' && (lotIdentifier || expirationDate)) throw new ApiError(409, 'LOT_NOT_ALLOWED', `O produto ${product.name} usa estoque simples e não pode receber dados de lote.`);
  }
}
