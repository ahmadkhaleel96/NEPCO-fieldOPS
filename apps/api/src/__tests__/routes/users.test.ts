import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: {
    auth: { getUser: vi.fn() },
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
const { usersRoutes } = await import('../../routes/users.route');

function makeApp() {
  const app = new Hono();
  app.route('/users', usersRoutes);
  app.onError(errorHandler);
  return app;
}

// Helpers
function mockAuthUser(role: string, userId = 'user-1') {
  vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
    data: {
      user: {
        id: userId,
        email: 'test@nepco.jo',
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
  return { Authorization: 'Bearer token' };
}

function mockFromChain(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    ...overrides,
  };
  vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
  return chain;
}

describe('GET /users', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 401 with no token', async () => {
    const res = await app.request('/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin/engineer roles', async () => {
    mockAuthUser('driver');
    const res = await app.request('/users', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns paginated user list for admin', async () => {
    mockAuthUser('admin');
    const chain = mockFromChain();
    chain.order = vi.fn().mockResolvedValue({
      data: [{ id: 'u1', email: 'a@b.com' }],
      count: 1,
      error: null,
    });

    const res = await app.request('/users', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('returns paginated user list for engineer', async () => {
    mockAuthUser('engineer');
    const chain = mockFromChain();
    chain.order = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });

    const res = await app.request('/users', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('respects page and per_page query params', async () => {
    mockAuthUser('admin');
    const chain = mockFromChain();
    chain.order = vi.fn().mockResolvedValue({ data: [], count: 50, error: null });

    const res = await app.request('/users?page=2&per_page=10', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.per_page).toBe(10);
    expect(body.pagination.total_pages).toBe(5);
  });
});

describe('POST /users', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for non-admin', async () => {
    mockAuthUser('engineer');
    const res = await app.request('/users', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.com', full_name: 'Test', role: 'technician' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid payload', async () => {
    mockAuthUser('admin');
    const res = await app.request('/users', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', full_name: 'A' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 when email already exists', async () => {
    mockAuthUser('admin');
    vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered', name: 'AuthError', status: 422 },
    } as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>);

    const res = await app.request('/users', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dupe@nepco.jo', full_name: 'Dup User', role: 'driver' }),
    });
    expect(res.status).toBe(409);
  });

  it('creates a user and returns 201', async () => {
    mockAuthUser('admin');
    const createdAuthUser = { id: 'auth-123', email: 'new@nepco.jo' };
    vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValueOnce({
      data: { user: createdAuthUser },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>);

    const chain = mockFromChain();
    chain.single = vi.fn().mockResolvedValue({
      data: { id: 'u-123', email: 'new@nepco.jo', full_name: 'New User', role: 'driver' },
      error: null,
    });

    const res = await app.request('/users', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@nepco.jo', full_name: 'New User', role: 'driver' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('new@nepco.jo');
  });
});

describe('GET /users/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('allows user to fetch their own record', async () => {
    mockAuthUser('driver', 'user-self');
    const chain = mockFromChain();
    chain.single = vi.fn().mockResolvedValue({
      data: { id: 'user-self', email: 's@s.com' },
      error: null,
    });

    const res = await app.request('/users/user-self', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('blocks driver from fetching another user', async () => {
    mockAuthUser('driver', 'user-self');
    const res = await app.request('/users/other-user', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('allows admin to fetch any user', async () => {
    mockAuthUser('admin', 'admin-id');
    const chain = mockFromChain();
    chain.single = vi.fn().mockResolvedValue({
      data: { id: 'other-user', email: 'o@o.com' },
      error: null,
    });

    const res = await app.request('/users/other-user', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('returns 404 when user not found', async () => {
    mockAuthUser('admin');
    const chain = mockFromChain();
    chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });

    const res = await app.request('/users/nonexistent', { headers: authHeader() });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /users/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('allows user to update their own record', async () => {
    mockAuthUser('technician', 'user-self');
    const chain = mockFromChain();
    chain.single = vi.fn().mockResolvedValue({
      data: { id: 'user-self', full_name: 'Updated' },
      error: null,
    });

    const res = await app.request('/users/user-self', {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Updated' }),
    });
    expect(res.status).toBe(200);
  });

  it('blocks non-admin from updating another user', async () => {
    mockAuthUser('engineer', 'user-self');
    const res = await app.request('/users/other-user', {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Hacked' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid update data', async () => {
    mockAuthUser('admin', 'user-self');
    const res = await app.request('/users/user-self', {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'superuser' }),
    });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /users/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for non-admin', async () => {
    mockAuthUser('engineer');
    const res = await app.request('/users/u-1', { method: 'DELETE', headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('soft-deletes the user (sets is_active = false)', async () => {
    mockAuthUser('admin');
    const chain = mockFromChain();
    chain.single = vi.fn().mockResolvedValue({
      data: { id: 'u-1', is_active: false },
      error: null,
    });

    const res = await app.request('/users/u-1', { method: 'DELETE', headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.is_active).toBe(false);
  });
});
