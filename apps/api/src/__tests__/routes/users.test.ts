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

const V_SELF = '00000000-0000-0000-0000-000000000010';
const V_OTHER = '00000000-0000-0000-0000-000000000011';
const V_USER = '00000000-0000-0000-0000-000000000012';
const V_NOT_FOUND = '00000000-0000-0000-0000-000000000099';

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

describe('GET /users', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 401 with no token', async () => {
    const res = await app.request('/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin/engineer roles', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    const res = await app.request('/users', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns paginated user list for admin', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'u1', email: 'a@b.com' }],
        count: 1,
        error: null,
      }),
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
    mockUserProfile();
    mockFromChain({
      order: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    });

    const res = await app.request('/users', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('respects page and per_page query params', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      order: vi.fn().mockResolvedValue({ data: [], count: 50, error: null }),
    });

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
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for non-admin', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await app.request('/users', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.com', full_name: 'Test', role: 'technician' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid payload', async () => {
    mockAuthUser('admin');
    mockUserProfile();
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
    mockUserProfile();
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
    mockUserProfile();
    const createdAuthUser = { id: 'auth-123', email: 'new@nepco.jo' };
    vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValueOnce({
      data: { user: createdAuthUser },
      error: null,
    } as Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>);

    mockFromChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'u-123', email: 'new@nepco.jo', full_name: 'New User', role: 'driver' },
        error: null,
      }),
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
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('allows user to fetch their own record', async () => {
    mockAuthUser('driver', V_SELF);
    mockUserProfile(V_SELF);
    mockFromChain({
      single: vi.fn().mockResolvedValue({
        data: { id: V_SELF, email: 's@s.com' },
        error: null,
      }),
    });

    const res = await app.request(`/users/${V_SELF}`, { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('blocks driver from fetching another user', async () => {
    mockAuthUser('driver', V_SELF);
    mockUserProfile(V_SELF);
    const res = await app.request(`/users/${V_OTHER}`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('allows admin to fetch any user', async () => {
    mockAuthUser('admin', 'admin-id');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({
        data: { id: V_OTHER, email: 'o@o.com' },
        error: null,
      }),
    });

    const res = await app.request(`/users/${V_OTHER}`, { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('returns 404 when user not found', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });

    const res = await app.request(`/users/${V_NOT_FOUND}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /users/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('allows user to update their own record', async () => {
    mockAuthUser('technician', V_SELF);
    mockUserProfile(V_SELF);
    mockFromChain({
      single: vi.fn().mockResolvedValue({
        data: { id: V_SELF, full_name: 'Updated' },
        error: null,
      }),
    });

    const res = await app.request(`/users/${V_SELF}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Updated' }),
    });
    expect(res.status).toBe(200);
  });

  it('blocks non-admin from updating another user', async () => {
    mockAuthUser('engineer', V_SELF);
    mockUserProfile(V_SELF);
    const res = await app.request(`/users/${V_OTHER}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Hacked' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid update data', async () => {
    mockAuthUser('admin', V_SELF);
    mockUserProfile();
    const res = await app.request(`/users/${V_SELF}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'superuser' }),
    });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /users/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for non-admin', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await app.request(`/users/${V_USER}`, { method: 'DELETE', headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('soft-deletes the user (sets is_active = false)', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({
        data: { id: 'u-1', is_active: false },
        error: null,
      }),
    });

    const res = await app.request(`/users/${V_USER}`, { method: 'DELETE', headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.is_active).toBe(false);
  });
});
