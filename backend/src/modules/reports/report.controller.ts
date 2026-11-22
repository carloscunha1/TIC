import type { Request, Response } from 'express';
import { dashboardPeriodSchema, movementReportQuerySchema, reportPeriodSchema, salesReportQuerySchema } from './report.schemas.js';
import { ReportService, toCsv } from './report.service.js';

const service = new ReportService();

function respond(response: Response, format: 'json' | 'csv', filename: string, headers: string[], rows: Array<Array<unknown>>, data: unknown): void {
  if (format === 'csv') {
    response.type('text/csv').setHeader('Content-Disposition', `attachment; filename="${filename}"`).send(`\uFEFF${toCsv(headers, rows)}`);
    return;
  }
  response.status(200).json({ success: true, data, requestId: response.locals.requestId });
}

export async function stockPosition(request: Request, response: Response): Promise<void> {
  const query = reportPeriodSchema.parse(request.query);
  const data = await service.stockPosition();
  respond(response, query.format, 'posicao-estoque.csv', ['SKU', 'Produto', 'Unidade', 'Modo', 'Fisico', 'Disponivel', 'Minimo', 'Valor estimado', 'Zerado', 'Abaixo do minimo'], data.map((item) => [item.sku, item.product, item.unit, item.stockMode, item.physical, item.available, item.minimum, item.estimatedValue, item.zero, item.belowMinimum]), data);
}

export async function movements(request: Request, response: Response): Promise<void> {
  const query = movementReportQuerySchema.parse(request.query);
  const data = await service.movements(query);
  respond(response, query.format, 'movimentacoes-estoque.csv', ['Data', 'Produto', 'SKU', 'Tipo', 'Quantidade', 'Motivo', 'Lote', 'Responsavel'], data.movements.map((item) => [item.date.toISOString(), item.product, item.sku, item.type, item.quantity, item.reason, item.lot, item.actor]), data);
}

export async function validity(request: Request, response: Response): Promise<void> {
  const query = reportPeriodSchema.parse(request.query);
  const data = await service.validity();
  respond(response, query.format, 'validade-lotes.csv', ['Produto', 'SKU', 'Lote', 'Validade', 'Quantidade', 'Unidade', 'Status'], data.map((item) => [item.product, item.sku, item.lot, item.expirationDate?.toISOString().slice(0, 10), item.currentQuantity, item.unit, item.status]), data);
}

export async function lowRotation(request: Request, response: Response): Promise<void> {
  const query = reportPeriodSchema.parse(request.query);
  const data = await service.lowRotation(query);
  respond(response, query.format, 'baixa-rotatividade.csv', ['Produto', 'SKU', 'Quantidade vendida', 'De', 'Ate'], data.map((item) => [item.product, item.sku, item.soldQuantity, item.period.from, item.period.to]), data);
}

export async function supplierEntries(request: Request, response: Response): Promise<void> {
  const query = reportPeriodSchema.parse(request.query);
  const data = await service.supplierEntries(query);
  respond(response, query.format, 'entradas-fornecedores.csv', ['Fornecedor', 'Entradas', 'Quantidade', 'Custo total'], data.suppliers.map((item) => [item.supplier, item.entries, item.quantity, item.totalCost]), data);
}

export async function sales(request: Request, response: Response): Promise<void> {
  const query = salesReportQuerySchema.parse(request.query);
  const data = await service.sales(query);
  respond(
    response,
    query.format,
    'relatorio-vendas.csv',
    ['Venda', 'Confirmada em', 'Status', 'Forma de pagamento', 'Operador', 'Cliente', 'Bruto', 'Liquido'],
    data.sales.map((item) => [item.id, item.confirmedAt?.toISOString() ?? '', item.status, item.paymentMethod ?? '', item.operator, item.customer ?? 'Sem cliente', item.gross, item.liquid]),
    data,
  );
}

export async function loyalty(request: Request, response: Response): Promise<void> {
  const query = reportPeriodSchema.parse(request.query);
  const data = await service.loyalty(query);
  respond(
    response,
    query.format,
    'relatorio-fidelidade.csv',
    ['Cliente', 'Pontos concedidos', 'Pontos resgatados', 'Pontos expirados', 'Saldo em circulação'],
    data.ranking.map((item) => [item.customer, item.points, '', '', '']),
    data,
  );
}

export async function dashboard(request: Request, response: Response): Promise<void> {
  const query = dashboardPeriodSchema.parse(request.query);
  const data = await service.dashboard(query);
  response.status(200).json({ success: true, data, requestId: response.locals.requestId });
}
