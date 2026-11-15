import { Prisma } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { detectProductValueChanges } from './product.value-history.js';

describe('detectProductValueChanges', () => {
  it('records only changed price and cost fields with exact decimal values', () => {
    const changes = detectProductValueChanges({ cost: new Prisma.Decimal('1.00'), salePrice: new Prisma.Decimal('2.00') }, { cost: 1, salePrice: 2.5 });
    expect(changes.map(({ field, previousValue, newValue }) => [field, previousValue.toString(), newValue.toString()])).toEqual([['SALE_PRICE', '2', '2.5']]);
  });

  it('does not create history for values with the same numeric value', () => {
    expect(detectProductValueChanges({ cost: '1.00', salePrice: '2.00' }, { cost: 1, salePrice: 2 })).toEqual([]);
  });
});
