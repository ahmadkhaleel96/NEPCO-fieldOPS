import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies before importing app
vi.mock('../lib/supabase', () => ({
  supabaseAnon: { auth: { getUser: vi.fn(), signOut: vi.fn() } },
  supabaseAdmin: {
    auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      head: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('../lib/redis', () => ({
  redis: {},
  authRateLimiter: { limit: vi.fn().mockResolvedValue({ success: true, reset: 0 }) },
  apiRateLimiter: { limit: vi.fn().mockResolvedValue({ success: true, reset: 0 }) },
}));

const { createApp } = await import('../app');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});

describe('Security headers', () => {
  it('includes HSTS header', async () => {
    const app = createApp();
    const res = await app.request('/health');
    const hsts = res.headers.get('Strict-Transport-Security');
    expect(hsts).toContain('max-age=63072000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('includes X-Content-Type-Options: nosniff', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('includes X-Frame-Options: DENY', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });
});

describe('Unknown routes', () => {
  it('returns 404 for unknown paths', async () => {
    const app = createApp();
    const res = await app.request('/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('OpenAPI spec', () => {
  it('serves /openapi.json in non-production', async () => {
    process.env['NODE_ENV'] = 'development';
    const app = createApp();
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe('3.0.0');
    expect(spec.info.title).toBe('NEPCO FieldOps API');
  });
});
