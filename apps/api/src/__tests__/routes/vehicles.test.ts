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
const { vehiclesRoutes } = await import('../../routes/vehicles.route');

function makeApp() {
  const app = new Hono();
  app.route('/vehicles', vehiclesRoutes);
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
  range: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
};

function mockFromChain(overrides: Record<string, unknown> = {}): MockChain {
  const chain: MockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    ...overrides,
  };
  vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
  return chain;
}

const V_VEHICLE = 'bbbbbbbb-0000-0000-0000-000000000001';
const V_NOT_FOUND = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const MOCK_VEHICLE = {
  id: 'v-1',
  vehicle_code: 'VH-001',
  plate_number: 'ABC-1234',
  model: 'Toyota Land Cruiser',
  is_active: true,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('GET /vehicles', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 401 without auth', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Unauthorized' } as never,
    });
    const res = await app.request('/vehicles', { headers: authHeader() });
    expect(res.status).toBe(401);
  });

  it('returns paginated vehicle list', async () => {
    mockAuthUser('engineer');
    mockFromChain({
      order: vi.fn().mockResolvedValue({ data: [MOCK_VEHICLE], count: 1, error: null }),
    });

    const res = await app.request('/vehicles', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });
});

describe('POST /vehicles', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for driver role', async () => {
    mockAuthUser('driver');
    const res = await app.request('/vehicles', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for missing required fields', async () => {
    mockAuthUser('engineer');
    const res = await app.request('/vehicles', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'Toyota' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates vehicle and returns 201', async () => {
    mockAuthUser('engineer');
    const chain = mockFromChain({
      single: vi.fn().mockResolvedValue({ data: MOCK_VEHICLE, error: null }),
    });
    chain.select.mockReturnValue(chain);

    const res = await app.request('/vehicles', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_code: 'VH-001',
        plate_number: 'ABC-1234',
        model: 'Toyota Land Cruiser',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: typeof MOCK_VEHICLE };
    expect(body.data.vehicle_code).toBe('VH-001');
  });

  it('returns 409 for duplicate vehicle_code', async () => {
    mockAuthUser('engineer');
    const chain = mockFromChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'duplicate key value violates unique constraint' } }),
    });
    chain.select.mockReturnValue(chain);

    const res = await app.request('/vehicles', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_code: 'VH-001', plate_number: 'ABC-1234' }),
    });
    expect(res.status).toBe(409);
  });
});

describe('GET /vehicles/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 404 when not found', async () => {
    mockAuthUser('engineer');
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const res = await app.request(`/vehicles/${V_NOT_FOUND}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });

  it('returns vehicle by id', async () => {
    mockAuthUser('engineer');
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: MOCK_VEHICLE, error: null }),
    });
    const res = await app.request(`/vehicles/${V_VEHICLE}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_VEHICLE };
    expect(body.data.vehicle_code).toBe('VH-001');
  });
});

describe('PATCH /vehicles/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for driver role', async () => {
    mockAuthUser('driver');
    const res = await app.request(`/vehicles/${V_VEHICLE}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate_number: 'XYZ-9999' }),
    });
    expect(res.status).toBe(403);
  });

  it('updates vehicle plate number', async () => {
    mockAuthUser('admin');
    const updated = { ...MOCK_VEHICLE, plate_number: 'XYZ-9999' };
    const chain = mockFromChain({
      single: vi.fn().mockResolvedValue({ data: updated, error: null }),
    });
    chain.select.mockReturnValue(chain);

    const res = await app.request(`/vehicles/${V_VEHICLE}`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plate_number: 'XYZ-9999' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_VEHICLE };
    expect(body.data.plate_number).toBe('XYZ-9999');
  });
});

describe('DELETE /vehicles/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    const res = await app.request(`/vehicles/${V_VEHICLE}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    expect(res.status).toBe(403);
  });

  it('soft-deletes vehicle for admin', async () => {
    mockAuthUser('admin');
    const chain = mockFromChain({
      single: vi.fn().mockResolvedValue({ data: { ...MOCK_VEHICLE, is_active: false }, error: null }),
    });
    chain.select.mockReturnValue(chain);

    const res = await app.request(`/vehicles/${V_VEHICLE}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { is_active: boolean } };
    expect(body.data.is_active).toBe(false);
  });
});
