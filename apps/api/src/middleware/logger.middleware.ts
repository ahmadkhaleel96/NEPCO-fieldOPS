import { createMiddleware } from 'hono/factory';
import { createHash } from 'crypto';

let requestCounter = 0;

function generateRequestId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}

/**
 * Structured JSON logger middleware.
 *
 * Privacy requirements (from threat model):
 * - Logs NEVER contain permit contents, inspection form data, or GPS coordinates
 * - user_id is hashed (SHA-256 first 16 chars) — not the raw UUID
 * - Only IDs and action codes are logged
 */
export const loggerMiddleware = createMiddleware(async (c, next) => {
  const requestId = generateRequestId();
  const start = Date.now();

  c.set('requestId', requestId);

  await next();

  c.header('X-Request-ID', requestId);

  const durationMs = Date.now() - start;
  const userId = c.get('userId') as string | undefined;

  const logEntry = {
    level: c.res.status >= 500 ? 'error' : c.res.status >= 400 ? 'warn' : 'info',
    timestamp: new Date().toISOString(),
    request_id: requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration_ms: durationMs,
    // Hash user_id — never log raw UUID in production
    user_id: userId
      ? createHash('sha256').update(userId).digest('hex').slice(0, 16)
      : null,
  };

  process.stdout.write(JSON.stringify(logEntry) + '\n');
});
