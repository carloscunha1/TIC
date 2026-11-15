import { z } from 'zod';

export const categoryStatusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });
