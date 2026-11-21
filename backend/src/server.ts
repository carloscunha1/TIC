import { app } from './app.js';
import { runDatabaseBootstrap } from './infrastructure/database/bootstrap.js';
import { expireInProgressSales } from './modules/sales/sale-expiration.job.js';

const port = Number(process.env.PORT ?? 3333);
let server: ReturnType<typeof app.listen>;
let expirationTimer: ReturnType<typeof setInterval> | undefined;

try {
  await runDatabaseBootstrap();
  server = app.listen(port, () => {
    console.log(`TIC backend listening on port ${port}`);
  });
  const runExpiration = async () => {
    try {
      const expiredCount = await expireInProgressSales();
      if (expiredCount > 0) {
        console.log(JSON.stringify({ event: 'sales.drafts.expired', level: 'info', expiredCount, timestamp: new Date().toISOString() }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'sales.drafts.expiration_failed',
        level: 'error',
        message: error instanceof Error ? error.message : 'Draft sale expiration failed.',
        timestamp: new Date().toISOString(),
      }));
    }
  };
  await runExpiration();
  expirationTimer = setInterval(runExpiration, 60_000);
} catch (error) {
  console.error(JSON.stringify({
    code: 'DATABASE_BOOTSTRAP_FAILED',
    event: 'server.startup_failed',
    level: 'error',
    message: error instanceof Error ? error.message : 'Database bootstrap failed.',
    timestamp: new Date().toISOString(),
  }));
  process.exitCode = 1;
}

function shutDown(signal: string): void {
  console.log(JSON.stringify({ event: 'server.shutdown', level: 'info', signal, timestamp: new Date().toISOString() }));
  if (expirationTimer) clearInterval(expirationTimer);
  server?.close(() => process.exit(0));
}

process.once('SIGINT', () => shutDown('SIGINT'));
process.once('SIGTERM', () => shutDown('SIGTERM'));
