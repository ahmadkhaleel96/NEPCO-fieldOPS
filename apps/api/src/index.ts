import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env['API_PORT'] ?? 3000);
const app = createApp();

const server = serve({ fetch: app.fetch, port }, (info: { port: number }) => {
  process.stdout.write(
    JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: `NEPCO FieldOps API listening on port ${info.port}`,
      env: process.env['NODE_ENV'] ?? 'development',
    }) + '\n'
  );
});

function shutdown(signal: string) {
  process.stdout.write(
    JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: `${signal} received — shutting down` }) + '\n'
  );
  server.close(() => {
    process.stdout.write(
      JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: 'Server closed cleanly' }) + '\n'
    );
    process.exit(0);
  });
  // Force exit if still open after 10 s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
