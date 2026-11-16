import { describe, expect, it } from '@jest/globals';
import { resolveCustomerStatusTransition } from './customer.status.js';

describe('resolveCustomerStatusTransition', () => {
  it('preserves pending PIN state when a pending customer is reactivated', () => {
    expect(resolveCustomerStatusTransition('PENDING_PIN', null, 'INACTIVE')).toEqual({ status: 'INACTIVE', previousStatus: 'PENDING_PIN' });
    expect(resolveCustomerStatusTransition('INACTIVE', 'PENDING_PIN', 'ACTIVE')).toEqual({ status: 'PENDING_PIN', previousStatus: null });
  });

  it('restores active customers and rejects invalid repeated transitions', () => {
    expect(resolveCustomerStatusTransition('ACTIVE', null, 'INACTIVE')).toEqual({ status: 'INACTIVE', previousStatus: 'ACTIVE' });
    expect(resolveCustomerStatusTransition('INACTIVE', 'ACTIVE', 'ACTIVE')).toEqual({ status: 'ACTIVE', previousStatus: null });
    expect(() => resolveCustomerStatusTransition('INACTIVE', 'ACTIVE', 'INACTIVE')).toThrow('CUSTOMER_ALREADY_INACTIVE');
    expect(() => resolveCustomerStatusTransition('ACTIVE', null, 'ACTIVE')).toThrow('CUSTOMER_NOT_INACTIVE');
  });
});
