import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/http/api-error.js';
import { createInventorySchema, recordInventoryCountSchema, type CreateInventoryInput } from './inventory.schemas.js';
import type { InventoryDetail, InventoryRepository } from './inventory.repository.js';

const movementDirection = {
  ENTRY: 1,
  ADJUSTMENT_IN: 1,
  RETURN_IN: 1,
  REVERSAL_IN: 1,
  EXIT: -1,
  ADJUSTMENT_OUT: -1,
  LOSS: -1,
  RETURN_OUT: -1,
  REVERSAL_OUT: -1,
} as const;

function serializeInventory(inventory: InventoryDetail) {
  const items = inventory.items.map((item) => {
    const delta = inventory.movements
      .filter((movement) => movement.productId === item.productId && (item.lotId ? movement.lotId === item.lotId : movement.lotId === null))
      .reduce((total, movement) => total.plus(movement.quantity.mul(movementDirection[movement.type])), new Prisma.Decimal(0));
    const expected = item.snapshotQuantity.plus(delta);
    return {
      id: item.id,
      productId: item.productId,
      lotId: item.lotId,
      product: item.product,
      lot: item.lot,
      snapshotQuantity: item.snapshotQuantity.toString(),
      countedQuantity: item.countedQuantity?.toString() ?? null,
      countedAt: item.countedAt?.toISOString() ?? null,
      expectedQuantity: expected.toString(),
      divergence: item.countedQuantity === null ? null : item.countedQuantity.minus(expected).toString(),
    };
  });
  return {
    id: inventory.id,
    type: inventory.type,
    status: inventory.status,
    observations: inventory.observations,
    startedAt: inventory.startedAt.toISOString(),
    createdAt: inventory.createdAt.toISOString(),
    updatedAt: inventory.updatedAt.toISOString(),
    createdBy: inventory.createdBy,
    items,
  };
}

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  async create(input: CreateInventoryInput, actorUserId: string, ipAddress?: string) {
    const data = createInventorySchema.parse(input);
    try {
      const inventory = await this.repository.create(data, actorUserId, ipAddress);
      return serializeInventory(inventory);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVENTORY_NO_PRODUCTS') throw new ApiError(400, 'INVENTORY_NO_PRODUCTS', 'Não há produtos para incluir neste inventário.');
      if (error instanceof Error && error.message === 'INVENTORY_PRODUCT_NOT_FOUND') throw new ApiError(404, 'INVENTORY_PRODUCT_NOT_FOUND', 'Um ou mais produtos selecionados não foram encontrados.');
      if (error instanceof Error && error.message === 'INVENTORY_CATEGORY_NOT_FOUND') throw new ApiError(404, 'INVENTORY_CATEGORY_NOT_FOUND', 'Uma ou mais categorias selecionadas não foram encontradas.');
      throw error;
    }
  }

  async list(page: number, pageSize: number) {
    const result = await this.repository.list(page, pageSize);
    return { ...result, page, pageSize, totalPages: Math.ceil(result.total / pageSize) };
  }

  async get(id: string) {
    const inventory = await this.repository.findById(id);
    if (!inventory) throw new ApiError(404, 'INVENTORY_NOT_FOUND', 'Inventário não encontrado.');
    return serializeInventory(inventory);
  }

  async recordCount(inventoryId: string, itemId: string, input: unknown, actorUserId: string, ipAddress?: string) {
    const { countedQuantity } = recordInventoryCountSchema.parse(input);
    const target = await this.repository.findCountTarget(inventoryId, itemId);
    if (!target) throw new ApiError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Item não encontrado neste inventário.');
    if (target.status !== 'EM_ANDAMENTO') throw new ApiError(409, 'INVENTORY_NOT_OPEN', 'As contagens deste inventário estão encerradas.');
    const quantity = new Prisma.Decimal(countedQuantity);
    if (target.unit === 'UN' && !quantity.isInteger()) throw new ApiError(400, 'INVALID_UNIT_QUANTITY', 'Produtos vendidos por unidade aceitam apenas quantidades inteiras.');
    try {
      return await this.repository.recordCount(inventoryId, itemId, quantity, actorUserId, ipAddress);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVENTORY_NOT_FOUND') throw new ApiError(404, 'INVENTORY_NOT_FOUND', 'Inventário não encontrado.');
      if (error instanceof Error && error.message === 'INVENTORY_NOT_OPEN') throw new ApiError(409, 'INVENTORY_NOT_OPEN', 'As contagens deste inventário estão encerradas.');
      if (error instanceof Error && error.message === 'INVENTORY_ITEM_NOT_FOUND') throw new ApiError(404, 'INVENTORY_ITEM_NOT_FOUND', 'Item não encontrado neste inventário.');
      throw error;
    }
  }
}
