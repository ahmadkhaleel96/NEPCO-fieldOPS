import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: {
    auth: { getUser: vi.fn() },
  },
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');
const { assetsRoutes } = await import('../../routes/assets.route');

function makeApp() {
  const app = new Hono();
  app.route('/assets', assetsRoutes);
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
  eq: ReturnType<typeof vi.fn>;
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
    eq: vi.fn().mockImplementation(() => chain),
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

const V_ASSET = 'aaaaaaaa-0000-0000-0000-000000000001';
const V_NOT_FOUND = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const MOCK_ASSET = {
  id: 'a-1',
  asset_code: 'TWR-001',
  asset_type: 'hv_tower',
  name: 'Tower 001',
  latitude: 31.9,
  longitude: 35.9,
  metadata: { tower_number: 'T1', line_name: 'L1', voltage_kv: 132 },
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('GET /assets', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 401 without auth', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Unauthorized' } as never,
    });
    const res = await app.request('/assets', { headers: authHeader() });
    expect(res.status).toBe(401);
  });

  it('returns paginated asset list for authenticated user', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({}, { data: [MOCK_ASSET], count: 1, error: null });

    const res = await app.request('/assets', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('filters by asset_type when query param provided', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const chain = mockFromChain({}, { data: [], count: 0, error: null });

    await app.request('/assets?asset_type=hv_tower', { headers: authHeader() });
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith('assets_view');
    expect((chain.eq as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['asset_type', 'hv_tower']);
  });
});

describe('POST /assets', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for technician role', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for missing required fields', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tower' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates asset and returns 201', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: MOCK_ASSET, error: null }),
    });

    const res = await app.request('/assets', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_code: 'TWR-001',
        asset_type: 'hv_tower',
        name: 'Tower 001',
        latitude: 31.9,
        longitude: 35.9,
        metadata: { tower_number: 'T1', line_name: 'L1', voltage_kv: 132 },
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: typeof MOCK_ASSET };
    expect(body.success).toBe(true);
    expect(body.data.asset_code).toBe('TWR-001');
  });

  it('returns 409 for duplicate asset_code', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      }),
    });

    const res = await app.request('/assets', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_code: 'TWR-001',
        asset_type: 'hv_tower',
        name: 'Tower 001',
        latitude: 31.9,
        longitude: 35.9,
        metadata: {},
      }),
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /assets/bulk-import', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  const VALID_ROW = { asset_code: 'TWR-002', asset_type: 'hv_tower', name: 'Tower 002', latitude: 31.9, longitude: 35.9 };

  it('returns 403 for technician role', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await app.request('/assets/bulk-import', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [VALID_ROW] }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for empty rows array', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const res = await app.request('/assets/bulk-import', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [] }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 when all rows are invalid', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const res = await app.request('/assets/bulk-import', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ asset_code: '', asset_type: 'bad_type', name: '', latitude: 999, longitude: 999 }] }),
    });
    expect(res.status).toBe(422);
  });

  it('imports valid rows and reports skipped duplicates', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({}, { data: [{ id: 'new-1' }], error: null });

    const res = await app.request('/assets/bulk-import', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [VALID_ROW, { ...VALID_ROW, asset_code: 'TWR-003', name: 'Tower 003' }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { imported: number; skipped: number; errors: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data.imported).toBe(1);  // 2 valid rows but only 1 returned from upsert (1 skipped)
    expect(body.data.skipped).toBe(1);
    expect(body.data.errors).toHaveLength(0);
  });

  it('returns partial results when some rows are invalid', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({}, { data: [{ id: 'new-1' }], error: null });

    const res = await app.request('/assets/bulk-import', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [
        VALID_ROW,
        { asset_code: '', asset_type: 'bad', name: '', latitude: 999, longitude: 999 },
      ] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { imported: number; errors: Array<{ row: number }> } };
    expect(body.data.imported).toBe(1);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0].row).toBe(2);
  });
});

describe('GET /assets/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 404 when not found', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });

    const res = await app.request(`/assets/${V_NOT_FOUND}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });

  it('returns asset by id', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: MOCK_ASSET, error: null }),
    });

    const res = await app.request(`/assets/${V_ASSET}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_ASSET };
    expect(body.data.id).toBe('a-1');
  });
});

describe('PATCH /assets/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for technician role', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await app.request(`/assets/${V_ASSET}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(403);
  });

  it('updates asset name', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const updated = { ...MOCK_ASSET, name: 'Updated Tower' };
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    });

    const res = await app.request(`/assets/${V_ASSET}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Tower' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_ASSET };
    expect(body.data.name).toBe('Updated Tower');
  });
});

describe('DELETE /assets/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await app.request(`/assets/${V_ASSET}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    expect(res.status).toBe(403);
  });

  it('soft-deletes asset for admin', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: { ...MOCK_ASSET, is_active: false }, error: null }),
    });

    const res = await app.request(`/assets/${V_ASSET}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { is_active: boolean } };
    expect(body.data.is_active).toBe(false);
  });
});
