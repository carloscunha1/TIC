import { PrismaReportRepository } from './report.repository.js';
import type { MovementReportQuery, ReportPeriod, SalesReportQuery } from './report.schemas.js';

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

  async sales(query: SalesReportQuery) {
    const [sales, total] = await this.repository.listSales(query);
    let gross = 0;
    let liquid = 0;
    let saleCount = 0;
    const paymentDistribution = new Map<string, number>();
    const productTotals = new Map<string, { productId: string; sku: string; product: string; quantity: number; liquidValue: number }>();

    for (const sale of sales) {
      if (sale.status !== 'CANCELADA' && sale.confirmedAt) {
        const grossValue = decimal(sale.total);
        let returnedValue = 0;
        let returnedQuantity = 0;
        for (const item of sale.items) {
          const confirmedQuantity = item.returns
            .filter((returned) => returned.returnRecord.status === 'CONFIRMADA')
            .reduce((sum, returned) => sum + decimal(returned.quantity), 0);
          const quantity = decimal(item.quantity) - confirmedQuantity;
          const itemLiquidValue = quantity * decimal(item.unitPrice);
          returnedQuantity += confirmedQuantity;
          returnedValue += confirmedQuantity * decimal(item.unitPrice);
          const product = productTotals.get(item.productId) ?? {
            productId: item.productId,
            sku: item.product.sku,
            product: item.product.name,
            quantity: 0,
            liquidValue: 0,
          };
          product.quantity += quantity;
          product.liquidValue += itemLiquidValue;
          productTotals.set(item.productId, product);
        }
        saleCount += 1;
        gross += grossValue;
        liquid += Math.max(grossValue - returnedValue, 0);
        const method = sale.paymentMethod ?? 'OTHER';
        paymentDistribution.set(method, (paymentDistribution.get(method) ?? 0) + Math.max(grossValue - returnedValue, 0));
      }
    }

    const products = [...productTotals.values()].sort((left, right) => right.quantity - left.quantity || left.product.localeCompare(right.product));
    return {
      sales: sales.map((sale) => {
        const returnedValue = sale.items.reduce((saleSum, item) => {
          const confirmedQuantity = item.returns
            .filter((returned) => returned.returnRecord.status === 'CONFIRMADA')
            .reduce((sum, returned) => sum + decimal(returned.quantity), 0);
          return saleSum + confirmedQuantity * decimal(item.unitPrice);
        }, 0);
        return {
          id: sale.id,
          confirmedAt: sale.confirmedAt,
          status: sale.status,
          paymentMethod: sale.paymentMethod,
          operator: sale.operator.name,
          customer: sale.customer?.name ?? null,
          gross: decimal(sale.total),
          liquid: sale.status === 'CANCELADA' ? 0 : Math.max(decimal(sale.total) - returnedValue, 0),
        };
      }),
      totals: {
        gross,
        liquid,
        averageTicket: saleCount > 0 ? liquid / saleCount : 0,
        paymentDistribution: [...paymentDistribution.entries()].map(([method, value]) => ({ method, value })),
      },
      products,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async loyalty(query: ReportPeriod) {
    const input = period(query);
    const [movements, customers] = await Promise.all([
      this.repository.listLoyaltyMovements(input),
      this.repository.listCustomersForLoyalty(),
    ]);
    const from = new Date(`${input.from}T00:00:00.000Z`);
    const to = new Date(`${input.to}T23:59:59.999Z`);
    const periodMovements = movements.filter((movement) => movement.createdAt >= from && movement.createdAt <= to);
    const granted = periodMovements.filter((movement) => movement.type === 'CREDIT').reduce((sum, movement) => sum + movement.pointsDelta, 0);
    const redeemed = periodMovements.filter((movement) => movement.type === 'REDEMPTION').reduce((sum, movement) => sum + Math.abs(movement.pointsDelta), 0);
    const expired = periodMovements.filter((movement) => movement.type === 'EXPIRATION').reduce((sum, movement) => sum + Math.abs(movement.pointsDelta), 0);
    const currentBalanceByCustomer = new Map(customers.map((customer) => [
      customer.id,
      customer.loyaltyMovements.reduce((sum, movement) => sum + movement.pointsDelta, 0),
    ]));
    const ranking = periodMovements
      .filter((movement) => movement.type === 'CREDIT')
      .reduce((map, movement) => {
        const current = map.get(movement.customerId) ?? { customerId: movement.customerId, customer: movement.customer.name, points: 0 };
        current.points += movement.pointsDelta;
        map.set(movement.customerId, current);
        return map;
      }, new Map<string, { customerId: string; customer: string; points: number }>());
    const negativeBalances = customers
      .map((customer) => ({ customerId: customer.id, customer: customer.name, status: customer.status, balance: currentBalanceByCustomer.get(customer.id) ?? 0 }))
      .filter((customer) => customer.balance < 0);
    return {
      period: { from: input.from, to: input.to },
      totals: {
        customersRegistered: customers.length,
        customersActive: customers.filter((customer) => customer.status === 'ACTIVE').length,
        granted,
        redeemed,
        expired,
        balanceInCirculation: customers.reduce((sum, customer) => sum + Math.max(currentBalanceByCustomer.get(customer.id) ?? 0, 0), 0),
      },
      ranking: [...ranking.values()].sort((left, right) => right.points - left.points || left.customer.localeCompare(right.customer)),
      negativeBalances,
      history: periodMovements.map((movement) => ({
        id: movement.id,
        date: movement.createdAt,
        customer: movement.customer.name,
        type: movement.type,
        points: movement.pointsDelta,
        reason: movement.reason,
      })),
    };
  }
}
