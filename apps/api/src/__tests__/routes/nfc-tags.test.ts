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
const { nfcTagsRoutes } = await import('../../routes/nfc-tags.route');

function makeApp() {
  const app = new Hono();
  app.route('/nfc-tags', nfcTagsRoutes);
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

/**
 * Sets up the auth middleware's profile lookup as the next `from()` call.
 * Must be called before any route-specific from() mocks.
 */
function mockUserProfile(id = 'profile-1') {
  const chain = makeChain({
    single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
  });
  vi.mocked(supabaseAdmin.from).mockReturnValueOnce(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
}

const V_TAG = 'cccccccc-0000-0000-0000-000000000001';
const V_NOT_FOUND = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const MOCK_TAG = {
  id: 'tag-1',
  tag_id: 'ABCD1234',
  status: 'provisioned',
  asset_id: 'asset-1',
  vehicle_id: null,
  vault_secret_id: 'vault:nfc:ABCD1234:1234567890',
  provisioned_by: 'user-1',
  replaced_by: null,
  install_lat: null,
  install_lng: null,
  install_photo_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('GET /nfc-tags', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for technician role', async () => {
    mockAuthUser('technician');
    mockUserProfile();
    const res = await app.request('/nfc-tags', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns paginated tag list for engineer', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({}, { data: [MOCK_TAG], count: 1, error: null });

    const res = await app.request('/nfc-tags', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });
});

describe('POST /nfc-tags', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234', asset_id: 'asset-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 when neither asset_id nor vehicle_id provided', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when both asset_id and vehicle_id provided', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234', asset_id: 'a-1', vehicle_id: 'v-1' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 409 when tag_id already registered', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const existingChain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
    });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(existingChain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234', asset_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(409);
  });

  it('provisions tag and returns 201', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    // 1: duplicate check — tag not registered
    const checkChain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(checkChain as unknown as ReturnType<typeof supabaseAdmin.from>);
    // 2: vault RPC returns a UUID
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: 'vault-uuid-1234', error: null } as never);
    // 3: insert the tag row
    const insertChain = makeChain({
      single: vi.fn().mockResolvedValue({ data: MOCK_TAG, error: null }),
    });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(insertChain as unknown as ReturnType<typeof supabaseAdmin.from>);

    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234', asset_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { tag_id: string } };
    expect(body.success).toBe(true);
    expect(body.data.tag_id).toBe('ABCD1234');
  });

  it('returns 500 when vault RPC fails', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const checkChain = makeChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(checkChain as unknown as ReturnType<typeof supabaseAdmin.from>);
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: null, error: { message: 'vault error' } } as never);

    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234', asset_id: '00000000-0000-0000-0000-000000000001' }),
    });
    expect(res.status).toBe(500);
  });
});

describe('GET /nfc-tags/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 404 when not found', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const res = await app.request(`/nfc-tags/${V_NOT_FOUND}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });

  it('returns tag without vault_secret_id', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: MOCK_TAG, error: null }),
    });
    const res = await app.request(`/nfc-tags/${V_TAG}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    expect(body.data.tag_id).toBe('ABCD1234');
    expect(body.data['vault_secret_id']).toBeUndefined();
  });
});

describe('GET /nfc-tags/:id/write-password', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await app.request(`/nfc-tags/${V_TAG}/write-password`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 404 when tag not found', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const res = await app.request(`/nfc-tags/${V_NOT_FOUND}/write-password`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });

  it('returns write password for admin', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: { vault_secret_id: 'vault-uuid-1234' }, error: null }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: 'A1B2C3D4', error: null } as never);

    const res = await app.request(`/nfc-tags/${V_TAG}/write-password`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { write_password: string } };
    expect(body.success).toBe(true);
    expect(body.data.write_password).toBe('A1B2C3D4');
  });

  it('returns 500 when vault read fails', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: { vault_secret_id: 'vault-uuid-1234' }, error: null }),
    });
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: null, error: { message: 'vault error' } } as never);

    const res = await app.request(`/nfc-tags/${V_TAG}/write-password`, { headers: authHeader() });
    expect(res.status).toBe(500);
  });
});

describe('PATCH /nfc-tags/:id/confirm-install', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.resetAllMocks(); });

  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    mockUserProfile();
    const res = await app.request(`/nfc-tags/${V_TAG}/confirm-install`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 31.9, longitude: 35.9, photo_url: 'https://example.com/photo.jpg' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid photo_url', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const res = await app.request(`/nfc-tags/${V_TAG}/confirm-install`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 31.9, longitude: 35.9, photo_url: 'not-a-url' }),
    });
    expect(res.status).toBe(422);
  });

  it('confirms installation and returns active tag', async () => {
    mockAuthUser('admin');
    mockUserProfile();
    const activeTag = { ...MOCK_TAG, status: 'active', install_lat: 31.9, install_lng: 35.9 };
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: activeTag, error: null }),
    });

    const res = await app.request(`/nfc-tags/${V_TAG}/confirm-install`, {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 31.9,
        longitude: 35.9,
        photo_url: 'https://r2.example.com/nfc/tag-1.jpg',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    expect(body.data['status']).toBe('active');
    expect(body.data['vault_secret_id']).toBeUndefined();
  });
});
