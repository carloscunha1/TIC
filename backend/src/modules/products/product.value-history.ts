import { Prisma, type ProductValueField } from '@prisma/client';

type ProductValues = { cost: Prisma.Decimal | string | number; salePrice: Prisma.Decimal | string | number };
export type ProductValueChange = { field: ProductValueField; previousValue: Prisma.Decimal; newValue: Prisma.Decimal };

export function detectProductValueChanges(before: ProductValues, after: ProductValues): ProductValueChange[] {
  const changes: ProductValueChange[] = [];
  const previousPrice = new Prisma.Decimal(before.salePrice);
  const nextPrice = new Prisma.Decimal(after.salePrice);
  const previousCost = new Prisma.Decimal(before.cost);
  const nextCost = new Prisma.Decimal(after.cost);
  if (!previousPrice.equals(nextPrice)) changes.push({ field: 'SALE_PRICE', previousValue: previousPrice, newValue: nextPrice });
  if (!previousCost.equals(nextCost)) changes.push({ field: 'COST', previousValue: previousCost, newValue: nextCost });
  return changes;
}
