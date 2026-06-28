import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../middleware/auth.middleware';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: {
    auth: {
      getUser: vi.fn(),
    },
  },
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn(),
  },
}));

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');

type MockChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
};

function makeChain(overrides: Partial<MockChain> = {}): MockChain {
  const chain = {} as MockChain;
  Object.assign(chain, {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => chain),
    ...overrides,
  });
  return chain;
}

function mockUserProfile(id = 'profile-1') {
  const chain = makeChain({
    single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
  });
  vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
}

function makeTestApp() {
  const app = new Hono<{ Variables: { userId: string; userProfileId: string; userRole: string; userEmail: string } }>();

  app.use('/protected/*', authMiddleware);
  app.get('/protected/hello', (c) => {
    return c.json({ userId: c.get('userId'), role: c.get('userRole') });
  });

  app.use('/admin/*', authMiddleware, requireRole('admin'));
  app.get('/admin/data', (c) => c.json({ ok: true }));

  app.use('/engineer-or-admin/*', authMiddleware, requireRole('admin', 'engineer'));
  app.get('/engineer-or-admin/data', (c) => c.json({ ok: true }));

  app.onError(errorHandler);

  return app;
}

describe('authMiddleware', () => {
  let app: ReturnType<typeof makeTestApp>;

  beforeEach(() => {
    app = makeTestApp();
    vi.resetAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.request('/protected/hello');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toMatch(/authorization/i);
  });

  it('returns 401 when token is not Bearer format', async () => {
    const res = await app.request('/protected/hello', {
      headers: { Authorization: 'Basic abc123' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when Supabase rejects the token', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid token', name: 'AuthError', status: 401 },
    } as Parameters<typeof supabaseAnon.auth.getUser>[0] extends never ? never : Awaited<ReturnType<typeof supabaseAnon.auth.getUser>>);

    const res = await app.request('/protected/hello', {
      headers: { Authorization: 'Bearer bad-token' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user has no role claim', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'test@nepco.jo',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '',
        },
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAnon.auth.getUser>>);

    const res = await app.request('/protected/hello', {
      headers: { Authorization: 'Bearer valid-but-no-role' },
    });
    expect(res.status).toBe(403);
  });

  it('injects userId and userRole on valid token', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-123',
          email: 'engineer@nepco.jo',
          app_metadata: { role: 'engineer' },
          user_metadata: {},
          aud: 'authenticated',
          created_at: '',
        },
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAnon.auth.getUser>>);
    mockUserProfile();

    const res = await app.request('/protected/hello', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-123');
    expect(body.role).toBe('engineer');
  });
});

describe('requireRole', () => {
  let app: ReturnType<typeof makeTestApp>;

  beforeEach(() => {
    app = makeTestApp();
    vi.resetAllMocks();
  });

  function mockUser(role: string) {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: {
        user: {
          id: 'user-1',
          email: 'u@nepco.jo',
          app_metadata: { role },
          user_metadata: {},
          aud: 'authenticated',
          created_at: '',
        },
      },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAnon.auth.getUser>>);
  }

  it('allows admin to access admin-only route', async () => {
    mockUser('admin');
    mockUserProfile();
    const res = await app.request('/admin/data', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(200);
  });

  it('blocks non-admin from admin-only route', async () => {
    mockUser('engineer');
    mockUserProfile();
    const res = await app.request('/admin/data', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toMatch(/access denied/i);
  });

  it('allows engineer to access engineer-or-admin route', async () => {
    mockUser('engineer');
    mockUserProfile();
    const res = await app.request('/engineer-or-admin/data', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(200);
  });

  it('blocks driver from engineer-or-admin route', async () => {
    mockUser('driver');
    mockUserProfile();
    const res = await app.request('/engineer-or-admin/data', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res.status).toBe(403);
  });
});
