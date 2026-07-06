import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/redis', () => ({
  authRateLimiter: { limit: vi.fn() },
  apiRateLimiter: { limit: vi.fn() },
  reportGenerationRateLimiter: { limit: vi.fn() },
}));

const { authRateLimiter, apiRateLimiter } = await import('../../lib/redis');
const { authRateLimitMiddleware, apiRateLimitMiddleware } = await import('../../middleware/rate-limit.middleware');

function makeAuthApp() {
  const app = new Hono();
  app.use(authRateLimitMiddleware);
  app.post('/auth/signin', (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

function makeApiApp() {
  const app = new Hono();
  app.use(apiRateLimitMiddleware);
  app.get('/api/resource', (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

const ALLOW = { success: true, reset: Date.now() + 60000, limit: 5, remaining: 4, pending: Promise.resolve() };
const DENY  = { success: false, reset: Date.now() + 30000, limit: 5, remaining: 0, pending: Promise.resolve() };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('authRateLimitMiddleware', () => {
  it('allows request when rate limit is not exceeded', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce(ALLOW);
    const res = await makeAuthApp().request('/auth/signin', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce(DENY);
    const res = await makeAuthApp().request('/auth/signin', { method: 'POST' });
    expect(res.status).toBe(429);
  });

  it('sets Retry-After header when rate limited', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce(DENY);
    const res = await makeAuthApp().request('/auth/signin', { method: 'POST' });
    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it('uses CF-Connecting-IP header when present', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce(ALLOW);
    await makeAuthApp().request('/auth/signin', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    expect(vi.mocked(authRateLimiter.limit)).toHaveBeenCalledWith('1.2.3.4');
  });

  it('falls back to X-Forwarded-For header', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce(ALLOW);
    await makeAuthApp().request('/auth/signin', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '5.6.7.8, 9.10.11.12' },
    });
    expect(vi.mocked(authRateLimiter.limit)).toHaveBeenCalledWith('5.6.7.8');
  });

  it('falls back to "unknown" when no IP headers are present', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce(ALLOW);
    await makeAuthApp().request('/auth/signin', { method: 'POST' });
    expect(vi.mocked(authRateLimiter.limit)).toHaveBeenCalledWith('unknown');
  });
});

describe('apiRateLimitMiddleware', () => {
  it('allows request when rate limit is not exceeded', async () => {
    vi.mocked(apiRateLimiter.limit).mockResolvedValueOnce(ALLOW);
    const res = await makeApiApp().request('/api/resource');
    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(apiRateLimiter.limit).mockResolvedValueOnce(DENY);
    const res = await makeApiApp().request('/api/resource');
    expect(res.status).toBe(429);
  });

  it('sets Retry-After header when rate limited', async () => {
    vi.mocked(apiRateLimiter.limit).mockResolvedValueOnce(DENY);
    const res = await makeApiApp().request('/api/resource');
    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
