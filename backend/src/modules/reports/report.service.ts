import { PrismaReportRepository } from './report.repository.js';
import type { MovementReportQuery, ReportPeriod } from './report.schemas.js';

const defaultFrom = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString().slice(0, 10);
};

function period(period: ReportPeriod): ReportPeriod {
  return { from: period.from ?? defaultFrom(), to: period.to ?? new Date().toISOString().slice(0, 10), format: period.format };
}

function decimal(value: { toString(): string } | number): number {
  return Number(value.toString());
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export class ReportService {
  constructor(private readonly repository = new PrismaReportRepository()) {}

  async stockPosition() {
    const products = await this.repository.listProducts();
    return products.map((product) => {
      const physical = product.stockMode === 'LOTE'
        ? product.stockLots.reduce((sum, lot) => sum + decimal(lot.currentQuantity), 0)
        : decimal(product.stockBalance?.quantity ?? 0);
      const available = product.stockMode === 'LOTE'
        ? product.stockLots
          .filter((lot) => !lot.expirationDate || lot.expirationDate >= new Date(new Date().toISOString().slice(0, 10)))
          .reduce((sum, lot) => sum + decimal(lot.currentQuantity), 0)
        : physical;
      return {
        productId: product.id,
        sku: product.sku,
        product: product.name,
        unit: product.unit,
        stockMode: product.stockMode,
        physical,
        available,
        minimum: decimal(product.minimumStock),
        estimatedValue: physical * decimal(product.cost),
        zero: available === 0,
        belowMinimum: available <= decimal(product.minimumStock),
      };
    });
  }

  async movements(query: MovementReportQuery) {
    const [movements, total] = await this.repository.listMovements(query);
    return {
      movements: movements.map((movement) => ({
        id: movement.id,
        date: movement.createdAt,
        product: movement.product.name,
        sku: movement.product.sku,
        unit: movement.product.unit,
        type: movement.type,
        quantity: decimal(movement.quantity),
        reason: movement.reason,
        lot: movement.lot?.identifier ?? null,
        actor: movement.actorUser.name,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async validity() {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const lots = await this.repository.listLots();
    return lots.map((lot) => {
      const expiration = lot.expirationDate;
      const alertDate = expiration ? new Date(expiration) : null;
      if (alertDate) alertDate.setUTCDate(alertDate.getUTCDate() - lot.product.expirationAlertDays);
      return {
        lotId: lot.id,
        product: lot.product.name,
        sku: lot.product.sku,
        lot: lot.identifier,
        expirationDate: expiration,
        currentQuantity: decimal(lot.currentQuantity),
        unit: lot.product.unit,
        status: !expiration ? 'SEM_VALIDADE' : expiration < today ? 'VENCIDO' : expiration >= today && alertDate && alertDate <= today ? 'PROXIMO_VENCIMENTO' : 'REGULAR',
      };
    });
  }

  async lowRotation(periodInput: ReportPeriod) {
    const input = period(periodInput);
    const from = new Date(`${input.from}T00:00:00.000Z`);
    const products = await this.repository.listProductsWithSales(input);
    return products.map((product) => {
      const soldQuantity = product.saleItems
        .filter((item) => item.sale.confirmedAt && item.sale.confirmedAt >= from && item.sale.status !== 'CANCELADA')
        .reduce((sum, item) => sum + decimal(item.quantity), 0);
      return { productId: product.id, sku: product.sku, product: product.name, soldQuantity, period: { from: input.from, to: input.to } };
    }).filter((product) => product.soldQuantity === 0);
  }

  async supplierEntries(periodInput: ReportPeriod) {
    const input = period(periodInput);
    const entries = await this.repository.listEntries(input);
    const suppliers = new Map<string, { supplier: string; entries: number; quantity: number; totalCost: number }>();
    const products = new Map<string, { product: string; sku: string; quantity: number; totalCost: number; entries: number }>();
    for (const entry of entries) {
      const supplierName = entry.supplier?.name ?? 'Sem fornecedor';
      const supplier = suppliers.get(supplierName) ?? { supplier: supplierName, entries: 0, quantity: 0, totalCost: 0 };
      supplier.entries += 1;
      for (const item of entry.items) {
        const quantity = decimal(item.quantity);
        const totalCost = quantity * decimal(item.unitCost);
        supplier.quantity += quantity;
        supplier.totalCost += totalCost;
        const product = products.get(item.product.id) ?? { product: item.product.name, sku: item.product.sku, quantity: 0, totalCost: 0, entries: 0 };
        product.quantity += quantity;
        product.totalCost += totalCost;
        product.entries += 1;
        products.set(item.product.id, product);
      }
      suppliers.set(supplierName, supplier);
    }
    return { period: { from: input.from, to: input.to }, suppliers: [...suppliers.values()], products: [...products.values()] };
  }
}
