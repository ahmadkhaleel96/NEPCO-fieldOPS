import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Must run before any app imports — static imports are hoisted but these
// built-in imports don't touch env vars, so env loading here is safe.
if (process.env['NODE_ENV'] !== 'production') {
  const dir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(dir, '../../../.env.local');
  try {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      if (key && !(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No .env.local — rely on shell environment
  }
}

// Dynamic imports run AFTER env vars are set
const { serve } = await import('@hono/node-server');
const { createApp } = await import('./app.js');

const port = Number(process.env['API_PORT'] ?? 3000);
const app = createApp();

const server = serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info: { port: number }) => {
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
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
