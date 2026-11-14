import { prisma } from './prisma.js';
import { runDatabaseBootstrap } from './bootstrap.js';

try {
  await runDatabaseBootstrap();
} catch (error) {
  console.error(JSON.stringify({
    code: 'DATABASE_BOOTSTRAP_FAILED',
    event: 'database.bootstrap_failed',
    level: 'error',
    message: error instanceof Error ? error.message : 'Database bootstrap failed.',
    timestamp: new Date().toISOString(),
  }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
