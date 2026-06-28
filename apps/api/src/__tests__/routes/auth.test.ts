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

function mockFromChain(overrides: Partial<MockChain> = {}, resolveWith?: unknown): MockChain {
  const chain = makeChain(overrides, resolveWith);
  vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
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
    } as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.signOut>>);

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
    } as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.signOut>>);

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
