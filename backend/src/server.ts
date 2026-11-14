import { app } from './app.js';

const port = Number(process.env.PORT ?? 3333);
const server = app.listen(port, () => {
  console.log(`TIC backend listening on port ${port}`);
});

function shutDown(signal: string): void {
  console.log(JSON.stringify({ event: 'server.shutdown', level: 'info', signal, timestamp: new Date().toISOString() }));
  server.close(() => process.exit(0));
}

process.once('SIGINT', () => shutDown('SIGINT'));
process.once('SIGTERM', () => shutDown('SIGTERM'));
