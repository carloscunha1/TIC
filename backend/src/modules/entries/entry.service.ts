import { ApiError } from '../../shared/http/api-error.js';
import type { EntryDraftInput } from './entry.schemas.js';
import type { EntryRepository } from './entry.repository.js';

export class EntryService {
  constructor(private readonly repository: EntryRepository) {}

  async create(input: EntryDraftInput, actorUserId: string, ipAddress?: string) {
    await this.validate(input);
    return this.repository.createDraft({ ...input, actorUserId, ipAddress });
  }

  async update(id: string, input: EntryDraftInput, actorUserId: string, ipAddress?: string) {
    await this.validate(input);
    const updated = await this.repository.updateDraft(id, { ...input, actorUserId, ipAddress });
    if (!updated) {
      const current = await this.repository.findById(id);
      if (!current) throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Entrada não encontrada.');
      throw new ApiError(409, 'ENTRY_NOT_EDITABLE', 'Somente entradas em andamento podem ser editadas.');
    }
    return updated;
  }

  async get(id: string) {
    const entry = await this.repository.findById(id);
    if (!entry) throw new ApiError(404, 'ENTRY_NOT_FOUND', 'Entrada não encontrada.');
    return entry;
  }

  async list(page: number, pageSize: number) {
    const result = await this.repository.list(page, pageSize);
    return { ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize), entries: result.entries };
  }

  private async validate(input: EntryDraftInput): Promise<void> {
    if (input.supplierId) {
      const supplier = await this.repository.findActiveSupplier(input.supplierId);
      if (!supplier) throw new ApiError(400, 'SUPPLIER_INACTIVE_OR_NOT_FOUND', 'O fornecedor deve existir e estar ativo.');
    }

    const productIds = [...new Set(input.items.map(({ productId }) => productId))];
    const products = await this.repository.findActiveProducts(productIds);
    if (products.length !== productIds.length) throw new ApiError(400, 'PRODUCT_INACTIVE_OR_NOT_FOUND', 'Todos os produtos devem existir e estar ativos.');
    const productById = new Map(products.map((product) => [product.id, product]));

    for (const item of input.items) {
      const product = productById.get(item.productId);
      if (!product) continue;
      if (product.unit === 'UN' && !Number.isInteger(item.quantity)) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');
      if (product.stockMode === 'LOTE' && !item.lotIdentifier) throw new ApiError(400, 'LOT_REQUIRED', 'Informe a identificação do lote para produtos controlados por lote.');
      if (product.stockMode === 'SIMPLES' && (item.lotIdentifier || item.expirationDate)) throw new ApiError(400, 'LOT_NOT_ALLOWED', 'Produtos de estoque simples não aceitam informações de lote.');
    }
  }
}
