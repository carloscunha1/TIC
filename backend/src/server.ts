import { app } from './app.js';
import { runDatabaseBootstrap } from './infrastructure/database/bootstrap.js';

const port = Number(process.env.PORT ?? 3333);
let server: ReturnType<typeof app.listen>;

try {
  await runDatabaseBootstrap();
  server = app.listen(port, () => {
    console.log(`TIC backend listening on port ${port}`);
  });
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
  server?.close(() => process.exit(0));
}

process.once('SIGINT', () => shutDown('SIGINT'));
process.once('SIGTERM', () => shutDown('SIGTERM'));
