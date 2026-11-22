import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use datas no formato AAAA-MM-DD.');

export const reportPeriodSchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const movementReportQuerySchema = reportPeriodSchema.extend({
  productId: z.string().uuid().optional(),
  type: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS', 'RETURN_IN', 'RETURN_OUT', 'REVERSAL_IN', 'REVERSAL_OUT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const salesReportQuerySchema = reportPeriodSchema.extend({
  operatorId: z.string().uuid().optional(),
  paymentMethod: z.enum(['CASH', 'PIX', 'DEBIT', 'CREDIT', 'OTHER', 'LOYALTY']).optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['EM_ANDAMENTO', 'CONFIRMADA', 'PARCIALMENTE_DEVOLVIDA', 'DEVOLVIDA', 'CANCELADA']).optional(),
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type MovementReportQuery = z.infer<typeof movementReportQuerySchema>;
export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;
