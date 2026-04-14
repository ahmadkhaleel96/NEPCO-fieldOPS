import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { authRateLimiter, apiRateLimiter } from '../lib/redis';

function getClientIp(c: Parameters<Parameters<typeof createMiddleware>[0]>[0]): string {
  return (
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Strict rate limiter for authentication endpoints.
 * 5 requests per 60-second sliding window per IP.
 */
export const authRateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = getClientIp(c);
  const { success, reset } = await authRateLimiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    throw new HTTPException(429, {
      message: 'Too many authentication attempts. Please try again later.',
    });
  }

  await next();
});

/**
 * General API rate limiter.
 * 120 requests per 60 seconds per IP.
 */
export const apiRateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = getClientIp(c);
  const { success, reset } = await apiRateLimiter.limit(ip);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    throw new HTTPException(429, {
      message: 'Rate limit exceeded. Please slow down.',
    });
  }

  await next();
});
