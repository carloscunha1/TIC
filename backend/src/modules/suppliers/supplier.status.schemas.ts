import { z } from 'zod';
export const supplierStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });
