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

function mockFromChain(overrides: Record<string, unknown> = {}, resolveWith?: unknown): MockChain {
  // Use explicit chain reference (not mockReturnThis) — Vite SSR transform loses `this` binding
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
  vi.mocked(supabaseAdmin.from).mockReturnValue(chain as unknown as ReturnType<typeof supabaseAdmin.from>);
  return chain;
}

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
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for technician role', async () => {
    mockAuthUser('technician');
    const res = await app.request('/nfc-tags', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns paginated tag list for engineer', async () => {
    mockAuthUser('engineer');
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
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234', asset_id: 'asset-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 when neither asset_id nor vehicle_id provided', async () => {
    mockAuthUser('admin');
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
    const res = await app.request('/nfc-tags', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'ABCD1234', asset_id: 'a-1', vehicle_id: 'v-1' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 409 when tag_id already registered', async () => {
    mockAuthUser('admin');
    const existingChain = {} as MockChain;
    Object.assign(existingChain, {
      select: vi.fn().mockImplementation(() => existingChain),
      eq: vi.fn().mockImplementation(() => existingChain),
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
    // First call: maybeSingle returns null (tag not registered)
    const checkChain = {} as MockChain;
    Object.assign(checkChain, {
      select: vi.fn().mockImplementation(() => checkChain),
      eq: vi.fn().mockImplementation(() => checkChain),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(checkChain as unknown as ReturnType<typeof supabaseAdmin.from>);
    // Second call: insert
    const insertChain = {} as MockChain;
    Object.assign(insertChain, {
      insert: vi.fn().mockImplementation(() => insertChain),
      select: vi.fn().mockImplementation(() => insertChain),
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
});

describe('GET /nfc-tags/:id', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 404 when not found', async () => {
    mockAuthUser('engineer');
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const res = await app.request('/nfc-tags/nonexistent', { headers: authHeader() });
    expect(res.status).toBe(404);
  });

  it('returns tag without vault_secret_id', async () => {
    mockAuthUser('engineer');
    mockFromChain({
      single: vi.fn().mockResolvedValue({ data: MOCK_TAG, error: null }),
    });
    const res = await app.request('/nfc-tags/tag-1', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    expect(body.data.tag_id).toBe('ABCD1234');
    expect(body.data['vault_secret_id']).toBeUndefined();
  });
});

describe('PATCH /nfc-tags/:id/confirm-install', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); vi.clearAllMocks(); });

  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    const res = await app.request('/nfc-tags/tag-1/confirm-install', {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 31.9, longitude: 35.9, photo_url: 'https://example.com/photo.jpg' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid photo_url', async () => {
    mockAuthUser('admin');
    const res = await app.request('/nfc-tags/tag-1/confirm-install', {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 31.9, longitude: 35.9, photo_url: 'not-a-url' }),
    });
    expect(res.status).toBe(422);
  });

  it('confirms installation and returns active tag', async () => {
    mockAuthUser('admin');
    const activeTag = { ...MOCK_TAG, status: 'active', install_lat: 31.9, install_lng: 35.9 };
    const chain = mockFromChain({
      single: vi.fn().mockResolvedValue({ data: activeTag, error: null }),
    });
    chain.select.mockImplementation(() => chain);

    const res = await app.request('/nfc-tags/tag-1/confirm-install', {
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
