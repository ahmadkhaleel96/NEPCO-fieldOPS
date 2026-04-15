import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env['API_PORT'] ?? 3000);
const app = createApp();

serve({ fetch: app.fetch, port }, (info: { port: number }) => {
  process.stdout.write(
    JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: `NEPCO FieldOps API listening on port ${info.port}`,
      env: process.env['NODE_ENV'] ?? 'development',
    }) + '\n'
  );
});
