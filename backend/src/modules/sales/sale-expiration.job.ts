import { PrismaAuditRepository } from '../audit/audit.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { PrismaSaleCancellationRepository } from './sale-cancellation.repository.js';

const cancellationRepository = new PrismaSaleCancellationRepository(new AuditService(new PrismaAuditRepository()));

export async function expireInProgressSales(): Promise<number> {
  return cancellationRepository.expireDrafts();
}
