import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
}));

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');
const { followUpTasksRoutes } = await import('../../routes/follow-up-tasks.route');

function makeApp() {
  const app = new Hono();
  app.route('/follow-up-tasks', followUpTasksRoutes);
  app.onError(errorHandler);
  return app;
}

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
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
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
    select:      vi.fn().mockImplementation(() => chain),
    insert:      vi.fn().mockImplementation(() => chain),
    update:      vi.fn().mockImplementation(() => chain),
    delete:      vi.fn().mockImplementation(() => chain),
    eq:          vi.fn().mockImplementation(() => chain),
    neq:         vi.fn().mockImplementation(() => chain),
    in:          vi.fn().mockImplementation(() => chain),
    is:          vi.fn().mockImplementation(() => chain),
    not:         vi.fn().mockImplementation(() => chain),
    range:       vi.fn().mockImplementation(() => chain),
    order:       vi.fn().mockImplementation(() => chain),
    single:      vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => chain),
    ...overrides,
  });
  if (resolveWith !== undefined) {
    chain.then = (resolve, reject) =>
      Promise.resolve(resolveWith).then(resolve, reject);
  }
  return chain;
}


function mockUserProfile(id = 'profile-1') {
  const chain = makeChain({
    single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
  });
  vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
}

type MockFromReturn = ReturnType<typeof supabaseAdmin.from>;
function from(chain: MockChain) {
  return chain as unknown as MockFromReturn;
}

const TASK_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_TASK = {
  id: TASK_ID,
  inspection_id: '00000000-0000-0000-0000-000000000002',
  asset_id: '00000000-0000-0000-0000-000000000003',
  assigned_to: null,
  partial_form_data: { condition: 'fair' },
  notes: null,
  resolved_at: null,
  created_at: '2026-04-22T10:00:00.000Z',
  updated_at: '2026-04-22T10:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /follow-up-tasks
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /follow-up-tasks', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'No token' },
    } as Awaited<ReturnType<typeof supabaseAnon.auth.getUser>>);

    const app = makeApp();
    const res = await app.request('/follow-up-tasks');
    expect(res.status).toBe(401);
  });

  it('returns 403 for technician role', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const app = makeApp();
    const res = await app.request('/follow-up-tasks', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated tasks for engineer', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const chain = makeChain({}, { data: [MOCK_TASK], count: 1, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/follow-up-tasks', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_TASK[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('returns 200 with paginated tasks for team_leader', async () => {
    mockAuthUser('team_leader');
    mockUserProfile();
    const chain = makeChain({}, { data: [], count: 0, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/follow-up-tasks', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('filters by resolved=false (unresolved tasks)', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const chain = makeChain({}, { data: [MOCK_TASK], count: 1, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/follow-up-tasks?resolved=false', { headers: authHeader() });
    expect(res.status).toBe(200);
    expect(chain.is).toHaveBeenCalledWith('resolved_at', null);
  });

  it('filters by resolved=true (resolved tasks)', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const chain = makeChain({}, { data: [], count: 0, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/follow-up-tasks?resolved=true', { headers: authHeader() });
    expect(res.status).toBe(200);
    expect(chain.not).toHaveBeenCalledWith('resolved_at', 'is', null);
  });

  it('returns 500 on DB error', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const chain = makeChain({}, { data: null, count: null, error: { message: 'DB error' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/follow-up-tasks', { headers: authHeader() });
    expect(res.status).toBe(500);
  });

  it('returns 200 with empty data when DB returns null data and null count', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const chain = makeChain({}, { data: null, count: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/follow-up-tasks', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; pagination: { total: number } };
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /follow-up-tasks/:id
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /follow-up-tasks/:id', () => {
  it('returns 200 with task data', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const chain = makeChain({}, { data: MOCK_TASK, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_TASK };
    expect(body.data.id).toBe(TASK_ID);
  });

  it('returns 404 when task not found', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const chain = makeChain({}, { data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// PATCH /follow-up-tasks/:id/resolve
// ──────────────────────────────────────────────────────────────────────────────

describe('PATCH /follow-up-tasks/:id/resolve', () => {
  it('returns 403 for technician', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}/resolve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid JSON body', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}/resolve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('returns 422 for invalid payload', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}/resolve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'x'.repeat(501) }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 404 when task not found', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      from(makeChain({}, { data: null, error: null }))
    );

    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}/resolve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Done' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when task is already resolved', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const resolvedTask = { ...MOCK_TASK, resolved_at: '2026-04-22T12:00:00.000Z' };
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(
      from(makeChain({}, { data: resolvedTask, error: null }))
    );

    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}/resolve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Done' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 200 and resolves the task', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const resolvedTask = { ...MOCK_TASK, resolved_at: '2026-04-22T12:00:00.000Z', notes: 'Done' };

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({}, { data: MOCK_TASK, error: null })))         // fetch existing
      .mockReturnValueOnce(from(makeChain({}, { data: resolvedTask, error: null })));     // update

    const app = makeApp();
    const res = await app.request(`/follow-up-tasks/${TASK_ID}/resolve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Done' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { resolved_at: string } };
    expect(body.success).toBe(true);
    expect(body.data.resolved_at).not.toBeNull();
  });
});
