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
const { assetInspectionsRoutes } = await import('../../routes/asset-inspections.route');

function makeApp() {
  const app = new Hono();
  app.route('/asset-inspections', assetInspectionsRoutes);
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
const from = (chain: MockChain) => chain as unknown as MockFromReturn;

const V_TRIP       = '00000000-0000-0000-0000-000000000001';
const V_ASSET      = '00000000-0000-0000-0000-000000000002';
const V_PERMIT     = '00000000-0000-0000-0000-000000000003';
const V_IDEM_KEY   = '00000000-0000-0000-0000-000000000004';
const V_INSP_ID    = '00000000-0000-0000-0000-000000000005';

const VALID_BODY = {
  trip_id: V_TRIP,
  asset_id: V_ASSET,
  status: 'open',
  form_data: { condition: 'good', temperature: '35C' },
  idempotency_key: V_IDEM_KEY,
};

const MOCK_INSPECTION = {
  id: V_INSP_ID,
  trip_id: V_TRIP,
  asset_id: V_ASSET,
  submitted_by: 'user-1',
  status: 'open',
  form_data: { condition: 'good', temperature: '35C' },
  incomplete_reason: null,
  idempotency_key: V_IDEM_KEY,
  created_at: '2026-04-22T08:00:00.000Z',
  updated_at: '2026-04-22T08:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /asset-inspections', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' } as never,
    });
    const res = await makeApp().request('/asset-inspections', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 on invalid body', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await makeApp().request('/asset-inspections', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: 'not-a-uuid' }),
    });
    expect(res.status).toBe(422);
    const json = await res.json() as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when status=incomplete but incomplete_reason is missing', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await makeApp().request('/asset-inspections', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...VALID_BODY,
        status: 'incomplete',
        // no incomplete_reason
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 201 and creates inspection with diff on valid open submission', async () => {
    mockAuthUser('technician');
    mockUserProfile();

    // upsert inspection
    const upsertChain = makeChain({}, { data: MOCK_INSPECTION, error: null });
    // select asset metadata
    const assetChain = makeChain({}, {
      data: { metadata: { condition: 'fair', temperature: '30C' } },
      error: null,
    });
    // insert changes
    const changesInsertChain = makeChain({}, { data: [], error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(upsertChain))
      .mockReturnValueOnce(from(assetChain))
      .mockReturnValueOnce(from(changesInsertChain));

    const res = await makeApp().request('/asset-inspections', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    const json = await res.json() as { success: boolean; data: typeof MOCK_INSPECTION };
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(V_INSP_ID);
  });

  it('returns 201 and skips diff insert when no fields changed', async () => {
    mockAuthUser('technician');
    mockUserProfile();

    const upsertChain = makeChain({}, { data: MOCK_INSPECTION, error: null });
    // metadata matches form_data exactly — no diff
    const assetChain = makeChain({}, {
      data: { metadata: { condition: 'good', temperature: '35C' } },
      error: null,
    });

    let fromCallCount = 0;
    vi.mocked(supabaseAdmin.from).mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return from(upsertChain);
      return from(assetChain);
    });

    const res = await makeApp().request('/asset-inspections', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    // asset_changes.insert should NOT have been called (only 2 from() calls)
    expect(fromCallCount).toBe(2);
  });

  it('suspends the permit when incomplete_reason is safety_hazard', async () => {
    mockAuthUser('technician');
    mockUserProfile();

    const upsertChain = makeChain({}, { data: { ...MOCK_INSPECTION, status: 'incomplete', incomplete_reason: 'safety_hazard' }, error: null });
    const assetChain = makeChain({}, { data: { metadata: {} }, error: null });
    const changesInsertChain = makeChain({}, { data: [], error: null });
    const tripChain = makeChain({}, { data: { permit_id: V_PERMIT }, error: null });
    const updatePermitChain = makeChain({}, { data: {}, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(upsertChain))
      .mockReturnValueOnce(from(assetChain))
      .mockReturnValueOnce(from(changesInsertChain))
      .mockReturnValueOnce(from(tripChain))
      .mockReturnValueOnce(from(updatePermitChain));

    const res = await makeApp().request('/asset-inspections', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...VALID_BODY,
        status: 'incomplete',
        incomplete_reason: 'safety_hazard',
        form_data: { condition: 'damaged' },
      }),
    });

    expect(res.status).toBe(201);
    // Verify permit update was called
    expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith('work_permits');
  });
});

describe('GET /asset-inspections', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' } as never,
    });
    const res = await makeApp().request('/asset-inspections');
    expect(res.status).toBe(401);
  });

  it('returns 200 with paginated list', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const listChain = makeChain({}, { data: [MOCK_INSPECTION], error: null, count: 1 });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(listChain));

    const res = await makeApp().request('/asset-inspections?page=1&per_page=20', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as {
      success: boolean;
      data: unknown[];
      pagination: { total: number; page: number; per_page: number; total_pages: number };
    };
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.pagination.total).toBe(1);
  });

  it('filters by trip_id when provided', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const listChain = makeChain({}, { data: [], error: null, count: 0 });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(listChain));

    const res = await makeApp().request(`/asset-inspections?trip_id=${V_TRIP}`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    expect(listChain.eq).toHaveBeenCalledWith('trip_id', V_TRIP);
  });
});

describe('GET /asset-inspections/:id', () => {
  it('returns 200 with inspection and changes', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const inspWithChanges = { ...MOCK_INSPECTION, asset_changes: [] };
    const chain = makeChain({}, { data: inspWithChanges, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/asset-inspections/${V_INSP_ID}`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: typeof inspWithChanges };
    expect(json.data.id).toBe(V_INSP_ID);
  });

  it('returns 404 when inspection not found', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const chain = makeChain({}, { data: null, error: { message: 'Not found' } });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request('/asset-inspections/00000000-0000-0000-0000-000000000099', {
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
  });
});
