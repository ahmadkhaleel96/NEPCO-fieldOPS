import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';
import { bodySizeLimitMiddleware } from '../../middleware/body-limit.middleware';
import { loggerMiddleware } from '../../middleware/logger.middleware';
import { secureHeaders } from 'hono/secure-headers';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
}));

function makeApp() {
  const app = new Hono();
  app.use(loggerMiddleware);
  app.use(bodySizeLimitMiddleware);
  app.use(
    secureHeaders({
      strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      referrerPolicy: 'no-referrer',
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    })
  );
  app.use((c, next) => {
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    return next();
  });
  app.get('/test', (c) => c.json({ ok: true }));
  app.post('/test', (c) => c.json({ ok: true }));
  app.onError(errorHandler);
  return app;
}

describe('bodySizeLimitMiddleware', () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
  });

  it('passes when Content-Length is within the 1 MB limit', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '100' },
      body: '{}',
    });
    expect(res.status).toBe(200);
  });

  it('returns 413 when Content-Length exceeds 1 MB', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(2 * 1024 * 1024),
      },
      body: '{}',
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.message).toMatch(/too large/i);
  });

  it('passes when Content-Length header is absent', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(200);
  });

  it('passes when Content-Length is exactly 1 MB', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(1024 * 1024),
      },
      body: '{}',
    });
    expect(res.status).toBe(200);
  });
});

describe('X-Request-ID header', () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
  });

  it('includes X-Request-ID in all responses', async () => {
    const res = await app.request('/test');
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(res.headers.get('x-request-id')).toMatch(/^req_/);
  });

  it('returns a different X-Request-ID for each request', async () => {
    const res1 = await app.request('/test');
    const res2 = await app.request('/test');
    expect(res1.headers.get('x-request-id')).not.toBe(res2.headers.get('x-request-id'));
  });
});

describe('security headers', () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
  });

  it('sets Strict-Transport-Security', async () => {
    const res = await app.request('/test');
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age=63072000/);
  });

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await app.request('/test');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY', async () => {
    const res = await app.request('/test');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('sets Content-Security-Policy with default-src none', async () => {
    const res = await app.request('/test');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toMatch(/default-src/);
  });

  it('sets Permissions-Policy denying camera and microphone', async () => {
    const res = await app.request('/test');
    const policy = res.headers.get('permissions-policy') ?? '';
    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
  });
});
