import type { CustomerStatus } from '@prisma/client';

export function resolveCustomerStatusTransition(current: CustomerStatus, previous: CustomerStatus | null, requested: 'ACTIVE' | 'INACTIVE') {
  if (requested === 'INACTIVE') {
    if (current === 'INACTIVE') throw new Error('CUSTOMER_ALREADY_INACTIVE');
    return { status: 'INACTIVE' as CustomerStatus, previousStatus: current };
  }
  if (current !== 'INACTIVE') throw new Error('CUSTOMER_NOT_INACTIVE');
  return { status: previous && previous !== 'INACTIVE' ? previous : 'ACTIVE', previousStatus: null };
}
