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
const { workPermitsRoutes } = await import('../../routes/work-permits.route');

function makeApp() {
  const app = new Hono();
  app.route('/work-permits', workPermitsRoutes);
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
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise<unknown>;
  [key: string]: unknown;
};

function makeChain(resolveWith?: unknown): MockChain {
  const chain = {} as MockChain;
  Object.assign(chain, {
    select: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    range: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => chain),
  });
  if (resolveWith !== undefined) {
    chain.then = (resolve, reject) =>
      Promise.resolve(resolveWith).then(resolve, reject);
  }
  return chain;
}

const V1 = '00000000-0000-0000-0000-000000000001';
const V2 = '00000000-0000-0000-0000-000000000002';
const V3 = '00000000-0000-0000-0000-000000000003';
const V4 = '00000000-0000-0000-0000-000000000004';
const V_PERMIT = '00000000-0000-0000-0000-000000000005';
const V_NOT_FOUND = '00000000-0000-0000-0000-000000000099';

const MOCK_PERMIT = {
  id: 'permit-1',
  permit_number: 'WP-2026-001',
  permit_type: 'maintenance',
  status: 'issued',
  engineer_id: 'user-1',
  vehicle_id: V1,
  scheduled_start: '2026-04-20T08:00:00.000Z',
  scheduled_end: '2026-04-20T16:00:00.000Z',
  safety_notes: null,
  created_at: '2026-04-15T09:00:00.000Z',
  updated_at: '2026-04-15T09:00:00.000Z',
};

const VALID_CREATE_BODY = {
  permit_type: 'maintenance',
  vehicle_id: V1,
  asset_ids: [V2],
  scheduled_start: '2026-04-20T08:00:00.000Z',
  scheduled_end: '2026-04-20T16:00:00.000Z',
  team: {
    driver_id: V2,
    leader_id: V3,
    technician_ids: [V4],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /work-permits', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await app.request('/work-permits');
    expect(res.status).toBe(401);
  });

  it('returns paginated list for engineer', async () => {
    mockAuthUser('engineer');
    const chain = makeChain({ data: [MOCK_PERMIT], count: 1, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request('/work-permits', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('filters by status when provided', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: [], count: 0, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request('/work-permits?status=issued', { headers: authHeader() });
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith('status', 'issued');
  });
});

describe('POST /work-permits', () => {
  it('returns 403 for technician', async () => {
    mockAuthUser('technician');
    const app = makeApp();
    const res = await app.request('/work-permits', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_CREATE_BODY),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid body', async () => {
    mockAuthUser('engineer');
    const app = makeApp();
    const res = await app.request('/work-permits', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ permit_type: 'maintenance' }),
    });
    expect(res.status).toBe(422);
  });

  it('creates permit and returns 201', async () => {
    mockAuthUser('engineer');

    // Call 1: insert permit
    const permitChain = makeChain({ data: MOCK_PERMIT, error: null });
    // Call 2: insert permit_assets (fire-and-forget, just needs a thenable)
    const assetsChain = makeChain({ data: null, error: null });
    // Call 3: insert permit_members
    const membersChain = makeChain({ data: null, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(permitChain as unknown as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValueOnce(assetsChain as unknown as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValueOnce(membersChain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request('/work-permits', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_CREATE_BODY),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('permit-1');
  });

  it('inserts correct asset and member rows', async () => {
    mockAuthUser('engineer');

    const permitChain = makeChain({ data: MOCK_PERMIT, error: null });
    const assetsChain = makeChain({ data: null, error: null });
    const membersChain = makeChain({ data: null, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(permitChain as unknown as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValueOnce(assetsChain as unknown as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValueOnce(membersChain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    await app.request('/work-permits', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_CREATE_BODY),
    });

    expect(assetsChain.insert).toHaveBeenCalledWith([
      { permit_id: 'permit-1', asset_id: V2 },
    ]);
    // driver=V2, leader=V3, tech=V4 — unique set
    expect(membersChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: V2 }),
        expect.objectContaining({ user_id: V3 }),
        expect.objectContaining({ user_id: V4 }),
      ])
    );
  });
});

describe('GET /work-permits/:id', () => {
  it('returns permit with members and assets', async () => {
    mockAuthUser('engineer');
    const chain = makeChain({
      data: { ...MOCK_PERMIT, permit_members: [], permit_assets: [] },
      error: null,
    });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request(`/work-permits/${V_PERMIT}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { id: string } };
    expect(body.data.id).toBe('permit-1');
  });

  it('returns 404 when permit not found', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: null, error: { message: 'Not found' } });
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request(`/work-permits/${V_NOT_FOUND}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });
});

describe('POST /work-permits/:id/withdraw', () => {
  it('returns 403 for driver', async () => {
    mockAuthUser('driver');
    const app = makeApp();
    const res = await app.request(`/work-permits/${V_PERMIT}/withdraw`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Safety concern on site, must postpone.' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 when reason is too short', async () => {
    mockAuthUser('admin');
    const app = makeApp();
    const res = await app.request(`/work-permits/${V_PERMIT}/withdraw`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'short' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 409 when trip already started', async () => {
    mockAuthUser('engineer');
    // Trip exists
    const tripsChain = makeChain({ data: { id: 'trip-1' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(tripsChain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request(`/work-permits/${V_PERMIT}/withdraw`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Safety concern on site, must postpone.' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/trip has started/i);
  });

  it('withdraws permit and returns updated record', async () => {
    mockAuthUser('engineer');

    const tripsChain = makeChain({ data: null, error: null });
    const permitChain = makeChain({
      data: { ...MOCK_PERMIT, status: 'withdrawn' },
      error: null,
    });
    const eventsChain = makeChain({ data: null, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(tripsChain as unknown as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValueOnce(permitChain as unknown as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValueOnce(eventsChain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request(`/work-permits/${V_PERMIT}/withdraw`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Safety concern on site, must postpone.' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('withdrawn');
  });

  it('returns 409 when permit status cannot be withdrawn', async () => {
    mockAuthUser('admin');

    const tripsChain = makeChain({ data: null, error: null });
    // Permit update returns no data (already completed/active)
    const permitChain = makeChain({ data: null, error: { message: 'No rows' } });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(tripsChain as unknown as ReturnType<typeof supabaseAdmin.from>)
      .mockReturnValueOnce(permitChain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const app = makeApp();
    const res = await app.request(`/work-permits/${V_PERMIT}/withdraw`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Safety concern on site, must postpone.' }),
    });
    expect(res.status).toBe(409);
  });
});
