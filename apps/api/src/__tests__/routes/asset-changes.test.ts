import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: {
    auth: { getUser: vi.fn() },
  },
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');
const { assetChangesRoutes } = await import('../../routes/asset-changes.route');

function makeApp() {
  const app = new Hono();
  app.route('/asset-changes', assetChangesRoutes);
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
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
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
    order: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => chain),
    ...overrides,
  });
  if (resolveWith !== undefined) {
    chain.then = (resolve, reject) =>
      Promise.resolve(resolveWith).then(resolve, reject);
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

type MockFromReturn = ReturnType<typeof supabaseAdmin.from>;
const from = (chain: MockChain) => chain as unknown as MockFromReturn;

const V_CHANGE  = '00000000-0000-0000-0000-000000000001';
const V_ASSET   = '00000000-0000-0000-0000-000000000002';
const V_INSP    = '00000000-0000-0000-0000-000000000003';

const MOCK_CHANGE = {
  id: V_CHANGE,
  inspection_id: V_INSP,
  asset_id: V_ASSET,
  field_name: 'condition',
  old_value: 'fair',
  new_value: 'good',
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
  created_at: '2026-04-22T08:00:00.000Z',
};

const REVIEWED_CHANGE = { ...MOCK_CHANGE, status: 'approved', reviewed_by: 'user-1', reviewed_at: '2026-04-22T09:00:00.000Z' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /asset-changes', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' } as never,
    });
    const res = await makeApp().request('/asset-changes');
    expect(res.status).toBe(401);
  });

  it('returns 403 for technician', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await makeApp().request('/asset-changes', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 403 for team_leader', async () => {
    mockAuthUser('team_leader');
    mockUserProfile();
    const res = await makeApp().request('/asset-changes', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated list for engineer', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const listChain = makeChain({}, { data: [MOCK_CHANGE], error: null, count: 1 });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(listChain));

    const res = await makeApp().request('/asset-changes', { headers: authHeader() });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: unknown[];
      pagination: { total: number; page: number };
    };
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.pagination.total).toBe(1);
  });

  it('returns 200 with paginated list for admin', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const listChain = makeChain({}, { data: [MOCK_CHANGE], error: null, count: 1 });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(listChain));

    const res = await makeApp().request('/asset-changes?status=pending', { headers: authHeader() });
    expect(res.status).toBe(200);
    expect(listChain.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('filters by asset_id when provided', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const listChain = makeChain({}, { data: [], error: null, count: 0 });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(listChain));

    await makeApp().request(`/asset-changes?asset_id=${V_ASSET}`, { headers: authHeader() });
    expect(listChain.eq).toHaveBeenCalledWith('asset_id', V_ASSET);
  });
});

describe('PATCH /asset-changes/:id/approve', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' } as never,
    });
    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for technician', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 on invalid body', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid_action' }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { success: boolean; error: { code: string } };
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when change not found', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const chain = makeChain({}, { data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when change already reviewed', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const chain = makeChain({}, { data: { ...MOCK_CHANGE, status: 'approved' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 200 when engineer approves a pending change', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const fetchChain = makeChain({}, { data: MOCK_CHANGE, error: null });
    const historyChain = makeChain({}, { data: null, error: null });
    const updateChain = makeChain({}, { data: REVIEWED_CHANGE, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(fetchChain))
      .mockReturnValueOnce(from(historyChain))
      .mockReturnValueOnce(from(updateChain));

    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: typeof REVIEWED_CHANGE };
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('approved');
  });

  it('returns 200 when engineer rejects a pending change', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const fetchChain = makeChain({}, { data: MOCK_CHANGE, error: null });
    const historyChain = makeChain({}, { data: null, error: null });
    const rejectedChange = { ...REVIEWED_CHANGE, status: 'rejected' };
    const updateChain = makeChain({}, { data: rejectedChange, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(fetchChain))
      .mockReturnValueOnce(from(historyChain))
      .mockReturnValueOnce(from(updateChain));

    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', notes: 'Value looks incorrect' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { status: string } };
    expect(json.data.status).toBe('rejected');
  });

  it('includes conflict warning when a prior approval exists for the same field', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const fetchChain = makeChain({}, { data: MOCK_CHANGE, error: null });
    const historyChain = makeChain({}, {
      data: { approved_by: 'other-engineer', approved_at: '2026-04-21T10:00:00.000Z' },
      error: null,
    });
    const updateChain = makeChain({}, { data: REVIEWED_CHANGE, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(fetchChain))
      .mockReturnValueOnce(from(historyChain))
      .mockReturnValueOnce(from(updateChain));

    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; warning?: string };
    expect(json.warning).toBeDefined();
    expect(json.warning).toContain('previously updated');
  });

  it('returns 200 for admin approving a change', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const fetchChain = makeChain({}, { data: MOCK_CHANGE, error: null });
    const historyChain = makeChain({}, { data: null, error: null });
    const updateChain = makeChain({}, { data: REVIEWED_CHANGE, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(fetchChain))
      .mockReturnValueOnce(from(historyChain))
      .mockReturnValueOnce(from(updateChain));

    const res = await makeApp().request(`/asset-changes/${V_CHANGE}/approve`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });

    expect(res.status).toBe(200);
  });
});
