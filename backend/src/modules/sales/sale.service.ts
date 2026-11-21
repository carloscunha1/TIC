import { ApiError } from '../../shared/http/api-error.js';
import type { SaleConfirmationInput, SaleItemInput, SaleDraftInput, SaleUpdateInput } from './sale.schemas.js';
import type { SaleConfirmationData, SaleRepository } from './sale.repository.js';

export class SaleService {
  constructor(private readonly repository: SaleRepository) {}

  async create(input: SaleDraftInput, actorUserId: string, ipAddress?: string) {
    const products = await this.validateProducts(input.items);
    await this.validateCustomer(input.customerId);
    const productById = new Map(products.map((product) => [product.id, product]));
    return this.repository.createDraft({
      customerId: input.customerId,
      observations: input.observations,
      items: input.items.map((item) => ({ ...item, unitPrice: Number(productById.get(item.productId)!.salePrice) })),
      actorUserId,
      ipAddress,
    });
  }

  async update(id: string, input: SaleUpdateInput, actorUserId: string, ipAddress?: string) {
    await this.validateCustomer(input.customerId);
    const updated = await this.repository.updateDraft(id, { ...input, actorUserId, ipAddress });
    if (!updated) await this.ensureEditable(id);
    return updated;
  }

  async addItem(id: string, input: SaleItemInput, actorUserId: string, ipAddress?: string) {
    const product = await this.repository.findActiveProduct(input.productId);
    if (!product) throw new ApiError(400, 'PRODUCT_INACTIVE_OR_NOT_FOUND', 'O produto deve existir e estar ativo.');
    this.validateQuantity(input.quantity, product.unit);
    const result = await this.repository.addItem(id, { ...input, actorUserId, ipAddress });
    if (!result) await this.ensureEditable(id);
    return result;
  }

  async updateItem(id: string, itemId: string, quantity: number, actorUserId: string, ipAddress?: string) {
    const sale = await this.repository.findById(id);
    if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
    const item = sale.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new ApiError(404, 'SALE_ITEM_NOT_FOUND', 'Item da venda não encontrado.');
    this.validateQuantity(quantity, item.product.unit);
    const result = await this.repository.updateItem(id, itemId, quantity, actorUserId, ipAddress);
    if (!result) await this.ensureEditable(id);
    return result;
  }

  async removeItem(id: string, itemId: string, actorUserId: string, ipAddress?: string) {
    const sale = await this.repository.findById(id);
    if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
    if (!sale.items.some((item) => item.id === itemId)) throw new ApiError(404, 'SALE_ITEM_NOT_FOUND', 'Item da venda não encontrado.');
    if (sale.items.length === 1) throw new ApiError(400, 'SALE_REQUIRES_ITEM', 'A venda deve manter ao menos um item enquanto estiver em andamento.');
    const result = await this.repository.removeItem(id, itemId, actorUserId, ipAddress);
    if (!result) await this.ensureEditable(id);
    return result;
  }

  async get(id: string) {
    const sale = await this.repository.findById(id);
    if (!sale) throw new ApiError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
    return sale;
  }

  async list(page: number, pageSize: number) {
    const result = await this.repository.list(page, pageSize);
    return { ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) };
  }

  async confirm(id: string, input: SaleConfirmationInput, idempotencyKey: string, actorUserId: string, ipAddress?: string) {
    if (input.paymentMethod === 'LOYALTY' && !input.loyaltyPoints) {
      throw new ApiError(400, 'LOYALTY_POINTS_REQUIRED', 'Informe os pontos usados no pagamento por fidelidade.');
    }
    if (input.paymentMethod !== 'LOYALTY' && input.loyaltyPoints) {
      throw new ApiError(400, 'LOYALTY_PAYMENT_METHOD_REQUIRED', 'O pagamento com pontos exige a forma de pagamento FIDELIDADE.');
    }
    const data: SaleConfirmationData = {
      ...input,
      idempotencyKey,
      idempotencyFingerprint: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
      actorUserId,
      ipAddress,
    };
    return this.repository.confirm(id, data);
  }

  private async validateProducts(items: SaleItemInput[]) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.repository.findActiveProducts(productIds);
    if (products.length !== productIds.length) throw new ApiError(400, 'PRODUCT_INACTIVE_OR_NOT_FOUND', 'Todos os produtos devem existir e estar ativos.');
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const item of items) this.validateQuantity(item.quantity, productById.get(item.productId)!.unit);
    return products;
  }

  private async validateCustomer(customerId: string | null | undefined): Promise<void> {
    if (customerId && !(await this.repository.findActiveCustomer(customerId))) {
      throw new ApiError(400, 'CUSTOMER_INACTIVE_OR_NOT_FOUND', 'O cliente deve existir e estar ativo.');
    }
  }

  private validateQuantity(quantity: number, unit: string): void {
    if (unit === 'UN' && !Number.isInteger(quantity)) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');
  }

  private async ensureEditable(id: string): Promise<never> {
    const current = await this.repository.findById(id);
    if (!current) throw new ApiError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
    throw new ApiError(409, 'SALE_NOT_EDITABLE', 'Somente vendas em andamento podem ser editadas.');
  }
}
import { createHash } from 'node:crypto';
