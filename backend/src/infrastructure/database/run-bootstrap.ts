import { prisma } from './prisma.js';
import { runDatabaseBootstrap } from './bootstrap.js';

try {
  await runDatabaseBootstrap();
} catch {
  console.error(JSON.stringify({ event: 'database.bootstrap_failed', level: 'error', timestamp: new Date().toISOString() }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
