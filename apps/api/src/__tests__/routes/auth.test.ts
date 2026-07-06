import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
  supabaseAdmin: {
    auth: {
      admin: {
        signOut: vi.fn(),
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn(),
  },
}));

vi.mock('../../lib/redis', () => ({
  authRateLimiter: { limit: vi.fn() },
  apiRateLimiter: { limit: vi.fn() },
  reportGenerationRateLimiter: { limit: vi.fn() },
}));

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');
const { authRateLimiter } = await import('../../lib/redis');
const { authRoutes } = await import('../../routes/auth.route');

function makeApp() {
  const app = new Hono();
  app.route('/auth', authRoutes);
  app.onError(errorHandler);
  return app;
}

function mockAuthUser(role: string, userId = 'user-admin-1') {
  vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
    data: {
      user: {
        id: userId,
        email: 'admin@nepco.jo',
        app_metadata: { role },
        user_metadata: {},
        aud: 'authenticated',
        created_at: '',
      },
    },
    error: null,
  } as Awaited<ReturnType<typeof supabaseAnon.auth.getUser>>);
}

function authHeader() {
  return { Authorization: 'Bearer valid-token' };
}

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise<unknown>;
  [key: string]: unknown;
};

function makeChain(overrides: Partial<MockChain> = {}, resolveWith?: unknown): MockChain {
  const chain = {} as MockChain;
  Object.assign(chain, {
    select: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    upsert: vi.fn().mockImplementation(() => chain),
    delete: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    neq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => chain),
    ...overrides,
  });
  if (resolveWith !== undefined) {
    chain.then = (resolve, reject) => Promise.resolve(resolveWith).then(resolve, reject);
  }
  return chain;
}


function mockUserProfile(id = 'profile-1') {
  const chain = makeChain({
    single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
  });
  vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(authRateLimiter.limit).mockResolvedValue({
    success: true,
    reset: Date.now() + 60000,
    limit: 5,
    remaining: 4,
    pending: Promise.resolve(),
  });
});

describe('POST /auth/signin', () => {
  it('returns 422 for invalid payload', async () => {
    const res = await makeApp().request('/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await makeApp().request('/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 when Supabase rejects credentials', async () => {
    vi.mocked(supabaseAnon.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', name: 'AuthApiError', status: 400 },
    } as unknown as Awaited<ReturnType<typeof supabaseAnon.auth.signInWithPassword>>);

    const res = await makeApp().request('/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@nepco.jo', password: 'wrongpassword' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with access_token on valid credentials', async () => {
    vi.mocked(supabaseAnon.auth.signInWithPassword).mockResolvedValueOnce({
      data: {
        user: { id: 'user-1', email: 'admin@nepco.jo', app_metadata: { role: 'admin' } },
        session: {
          access_token: 'access-jwt',
          refresh_token: 'refresh-jwt',
          expires_in: 900,
        },
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabaseAnon.auth.signInWithPassword>>);

    const res = await makeApp().request('/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@nepco.jo', password: 'Password123!' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { access_token: string } };
    expect(body.data.access_token).toBe('access-jwt');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce({
      success: false, reset: Date.now() + 30000, limit: 5, remaining: 0, pending: Promise.resolve(),
    });
    const res = await makeApp().request('/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@nepco.jo', password: 'Password123!' }),
    });
    expect(res.status).toBe(429);
  });
});

describe('POST /auth/signout', () => {
  it('returns 401 without auth header', async () => {
    const res = await makeApp().request('/auth/signout', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and clears cookie on success', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    vi.mocked(supabaseAnon.auth.signOut).mockResolvedValueOnce({ error: null });

    const res = await makeApp().request('/auth/signout', {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('Max-Age=0');
  });

  it('returns 500 when Supabase signOut fails', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    vi.mocked(supabaseAnon.auth.signOut).mockResolvedValueOnce({
      error: { message: 'Service unavailable', name: 'AuthError', status: 503 },
    } as unknown as Awaited<ReturnType<typeof supabaseAnon.auth.signOut>>);

    const res = await makeApp().request('/auth/signout', {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(500);
  });
});

describe('POST /auth/refresh', () => {
  it('returns 401 when no refresh token cookie is present', async () => {
    const res = await makeApp().request('/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when Supabase rejects the refresh token', async () => {
    vi.mocked(supabaseAnon.auth.refreshSession).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token expired', name: 'AuthApiError', status: 401 },
    } as unknown as Awaited<ReturnType<typeof supabaseAnon.auth.refreshSession>>);

    const res = await makeApp().request('/auth/refresh', {
      method: 'POST',
      headers: { Cookie: 'fieldops_refresh=expired-token' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with new access_token and rotates cookie on success', async () => {
    vi.mocked(supabaseAnon.auth.refreshSession).mockResolvedValueOnce({
      data: {
        user: { id: 'user-1', email: 'admin@nepco.jo', app_metadata: { role: 'admin' } },
        session: { access_token: 'new-access-jwt', refresh_token: 'new-refresh-jwt', expires_in: 900 },
      },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabaseAnon.auth.refreshSession>>);

    const res = await makeApp().request('/auth/refresh', {
      method: 'POST',
      headers: { Cookie: 'fieldops_refresh=valid-refresh-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { access_token: string } };
    expect(body.data.access_token).toBe('new-access-jwt');
    const cookie = res.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('new-refresh-jwt');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce({
      success: false, reset: Date.now() + 30000, limit: 5, remaining: 0, pending: Promise.resolve(),
    });
    const res = await makeApp().request('/auth/refresh', {
      method: 'POST',
      headers: { Cookie: 'fieldops_refresh=some-token' },
    });
    expect(res.status).toBe(429);
  });
});

describe('POST /auth/revoke', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await makeApp().request('/auth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await makeApp().request('/auth/revoke', {
      method: 'POST',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 when user_id is not a valid UUID', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const res = await makeApp().request('/auth/revoke', {
      method: 'POST',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 on invalid JSON body', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const res = await makeApp().request('/auth/revoke', {
      method: 'POST',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 and revokes sessions when admin calls with valid UUID', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    vi.mocked(supabaseAdmin.auth.admin.signOut).mockResolvedValueOnce({
      data: {},
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.signOut>>);

    const res = await makeApp().request('/auth/revoke', {
      method: 'POST',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.message).toMatch(/revoked/i);
    expect(vi.mocked(supabaseAdmin.auth.admin.signOut)).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'global'
    );
  });

  it('returns 500 when Supabase signOut fails', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    vi.mocked(supabaseAdmin.auth.admin.signOut).mockResolvedValueOnce({
      data: {},
      error: { message: 'Auth service error', name: 'AuthError', status: 500 },
    } as unknown as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.signOut>>);

    const res = await makeApp().request('/auth/revoke', {
      method: 'POST',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(500);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(authRateLimiter.limit).mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 30000,
      limit: 5,
      remaining: 0,
      pending: Promise.resolve(),
    });

    const res = await makeApp().request('/auth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(429);
  });
});
