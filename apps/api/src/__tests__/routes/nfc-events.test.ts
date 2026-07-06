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
const { nfcEventsRoutes } = await import('../../routes/nfc-events.route');

function makeApp() {
  const app = new Hono();
  app.route('/nfc-events', nfcEventsRoutes);
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
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise<unknown>;
  [key: string]: unknown;
};

function makeChain(overrides: Partial<MockChain> = {}, resolveWith?: unknown): MockChain {
  const chain = {} as MockChain;
  Object.assign(chain, {
    select:     vi.fn().mockImplementation(() => chain),
    insert:     vi.fn().mockImplementation(() => chain),
    update:     vi.fn().mockImplementation(() => chain),
    upsert:     vi.fn().mockImplementation(() => chain),
    delete:     vi.fn().mockImplementation(() => chain),
    eq:         vi.fn().mockImplementation(() => chain),
    neq:        vi.fn().mockImplementation(() => chain),
    in:         vi.fn().mockImplementation(() => chain),
    single:     vi.fn().mockImplementation(() => chain),
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

const V_PERMIT = '00000000-0000-0000-0000-000000000001';
const V_TRIP   = '00000000-0000-0000-0000-000000000002';
const V_ASSET  = '00000000-0000-0000-0000-000000000003';

const VALID_ARRIVAL = {
  tag_id: 'SITE-TAG-001',
  trip_id: V_TRIP,
  lat: 31.95,
  lng: 35.91,
  client_id: '00000000-0000-0000-0000-000000000010',
  client_timestamp: '2026-04-20T09:00:00.000Z',
};

const MOCK_EVENT = {
  id: 'event-1',
  tag_id: 'SITE-TAG-001',
  event_type: 'site_arrival',
  trip_id: V_TRIP,
  permit_id: V_PERMIT,
  user_id: 'user-1',
  lat: 31.95,
  lng: 35.91,
  client_id: '00000000-0000-0000-0000-000000000010',
  client_timestamp: '2026-04-20T09:00:00.000Z',
  created_at: '2026-04-20T09:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('POST /nfc-events', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await app.request('/nfc-events', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid body', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    const app = makeApp();
    const res = await app.request('/nfc-events', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'X' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 404 when trip not found', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      from(makeChain({}, { data: null, error: null }))
    );
    const app = makeApp();
    const res = await app.request('/nfc-events', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ARRIVAL),
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 when NFC tag is not active', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({}, { data: { permit_id: V_PERMIT }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: null, error: null }))); // no active tag

    const app = makeApp();
    const res = await app.request('/nfc-events', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ARRIVAL),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/NFC_TAG_INVALID/);
  });

  it('returns 403 when asset is not in the permit', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({}, { data: { permit_id: V_PERMIT }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: { asset_id: V_ASSET }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: null, error: null }))); // asset not in permit

    const app = makeApp();
    const res = await app.request('/nfc-events', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ARRIVAL),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/ASSET_NOT_IN_PERMIT/);
  });

  it('records site arrival and returns event data', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({}, { data: { permit_id: V_PERMIT }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: { asset_id: V_ASSET }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: { asset_id: V_ASSET }, error: null })))   // asset in permit
      .mockReturnValueOnce(from(makeChain({}, { data: MOCK_EVENT, error: null })));              // insert event

    const app = makeApp();
    const res = await app.request('/nfc-events', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ARRIVAL),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { event_id: string; asset_id: string; permit_id: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.event_id).toBe('event-1');
    expect(body.data.permit_id).toBe(V_PERMIT);
  });

  it('returns success on duplicate client_id (idempotent)', async () => {
    mockAuthUser('driver');
    mockUserProfile();
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({}, { data: { permit_id: V_PERMIT }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: { asset_id: V_ASSET }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: { asset_id: V_ASSET }, error: null })))
      .mockReturnValueOnce(from(makeChain({}, { data: null, error: { message: 'duplicate key unique constraint' } })));

    const app = makeApp();
    const res = await app.request('/nfc-events', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_ARRIVAL),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { message: string } };
    expect(body.success).toBe(true);
    expect(body.data.message).toMatch(/already recorded/i);
  });
});
