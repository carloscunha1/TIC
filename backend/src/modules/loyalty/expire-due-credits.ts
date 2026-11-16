import { prisma } from '../../infrastructure/database/prisma.js';
import { PrismaLoyaltyRepository } from './loyalty.repository.js';
import { LoyaltyService } from './loyalty.service.js';

const service = new LoyaltyService(new PrismaLoyaltyRepository());
try {
  const result = await service.expireDueCredits();
  console.log(JSON.stringify({ event: 'loyalty.expiration.completed', ...result }));
} catch {
  console.error(JSON.stringify({ event: 'loyalty.expiration.failed' }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
