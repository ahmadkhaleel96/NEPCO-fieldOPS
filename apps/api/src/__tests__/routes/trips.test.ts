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
const { tripsRoutes } = await import('../../routes/trips.route');

function makeApp() {
  const app = new Hono();
  app.route('/trips', tripsRoutes);
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

function makeChain(resolveWith?: unknown): MockChain {
  const chain = {} as MockChain;
  Object.assign(chain, {
    select:     vi.fn().mockImplementation(() => chain),
    insert:     vi.fn().mockImplementation(() => chain),
    update:     vi.fn().mockImplementation(() => chain),
    upsert:     vi.fn().mockImplementation(() => chain),
    eq:         vi.fn().mockImplementation(() => chain),
    in:         vi.fn().mockImplementation(() => chain),
    is:         vi.fn().mockImplementation(() => chain),
    not:        vi.fn().mockImplementation(() => chain),
    range:      vi.fn().mockImplementation(() => chain),
    order:      vi.fn().mockImplementation(() => chain),
    single:     vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => chain),
  });
  if (resolveWith !== undefined) {
    chain.then = (resolve, reject) =>
      Promise.resolve(resolveWith).then(resolve, reject);
  }
  return chain;
}

type MockFromReturn = ReturnType<typeof supabaseAdmin.from>;

function from(chain: MockChain) {
  return chain as unknown as MockFromReturn;
}

const V1 = '00000000-0000-0000-0000-000000000001'; // vehicle_id
const V2 = '00000000-0000-0000-0000-000000000002'; // permit_id
const V3 = '00000000-0000-0000-0000-000000000003'; // driver/user

const MOCK_TAG_ROW = { id: 'tag-db-1', vehicle_id: V1, status: 'active' };
const MOCK_PERMIT_ROW = { id: V2, vehicle_id: V1, engineer_id: 'eng-1', status: 'issued' };
const MOCK_MEMBER_ROW = { id: 'mem-1' };
const MOCK_TRIP = {
  id: 'trip-1',
  permit_id: V2,
  driver_id: V3,
  vehicle_id: V1,
  start_time: '2026-04-20T08:00:00.000Z',
  end_time: null,
  start_lat: 31.95,
  start_lng: 35.91,
  end_lat: null,
  end_lng: null,
  client_id: '00000000-0000-0000-0000-000000000010',
  created_at: '2026-04-20T08:00:00.000Z',
};

const VALID_START_BODY = {
  tag_id: 'ABCD1234',
  permit_id: V2,
  lat: 31.95,
  lng: 35.91,
  client_id: '00000000-0000-0000-0000-000000000010',
  client_timestamp: '2026-04-20T08:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /trips
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /trips', () => {
  it('returns 403 for engineer role', async () => {
    mockAuthUser('engineer');
    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_START_BODY),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid body', async () => {
    mockAuthUser('driver');
    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'X' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 403 when NFC tag is not active', async () => {
    mockAuthUser('driver');
    // nfc_tags → no row
    vi.mocked(supabaseAdmin.from).mockReturnValue(
      from(makeChain({ data: null, error: null }))
    );
    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_START_BODY),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/NFC_TAG_NOT_FOUND/);
  });

  it('returns 403 when permit is not issued', async () => {
    mockAuthUser('driver');
    // nfc_tags → found
    // work_permits → not found
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: MOCK_TAG_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: null, error: null })));

    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_START_BODY),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/PERMIT_NOT_ISSUED/);
  });

  it('returns 403 when vehicle does not match permit', async () => {
    mockAuthUser('driver');
    const wrongTagRow = { ...MOCK_TAG_ROW, vehicle_id: '00000000-0000-0000-0000-000000000099' };
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: wrongTagRow, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: MOCK_PERMIT_ROW, error: null })));

    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_START_BODY),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/NFC_VEHICLE_MISMATCH/);
  });

  it('returns 403 when driver is not a permit member', async () => {
    mockAuthUser('driver');
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: MOCK_TAG_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: MOCK_PERMIT_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: null, error: null }))); // member not found

    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_START_BODY),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/NOT_PERMIT_DRIVER/);
  });

  it('returns 409 when trip already exists for this permit', async () => {
    mockAuthUser('driver');
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: MOCK_TAG_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: MOCK_PERMIT_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: MOCK_MEMBER_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: { id: 'trip-existing' }, error: null }))); // trip exists

    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_START_BODY),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/TRIP_ALREADY_EXISTS/);
  });

  it('creates trip and returns 201 on valid scan', async () => {
    mockAuthUser('driver');
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: MOCK_TAG_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: MOCK_PERMIT_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: MOCK_MEMBER_ROW, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: null, error: null })))           // no existing trip
      .mockReturnValueOnce(from(makeChain({ data: MOCK_TRIP, error: null })))      // insert trip
      .mockReturnValueOnce(from(makeChain({ data: null, error: null })));          // insert nfc_event

    const app = makeApp();
    const res = await app.request('/trips', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_START_BODY),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('trip-1');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /trips/:id/locations
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /trips/:id/locations', () => {
  const VALID_LOCATIONS = {
    locations: [
      {
        lat: 31.95,
        lng: 35.91,
        accuracy: 10,
        captured_at: '2026-04-20T08:01:00.000Z',
        client_id: '00000000-0000-0000-0000-000000000020',
      },
    ],
  };

  it('returns 422 for empty locations array', async () => {
    mockAuthUser('driver');
    const app = makeApp();
    const res = await app.request('/trips/trip-1/locations', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: [] }),
    });
    expect(res.status).toBe(422);
  });

  it('inserts locations and returns 200', async () => {
    mockAuthUser('driver');
    const chain = makeChain({ error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/trips/trip-1/locations', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_LOCATIONS),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { inserted: number } };
    expect(body.success).toBe(true);
    expect(body.data.inserted).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /trips/:id/track
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /trips/:id/track', () => {
  it('returns 403 for driver role', async () => {
    mockAuthUser('driver');
    const app = makeApp();
    const res = await app.request('/trips/trip-1/track', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns GeoJSON LineString for engineer', async () => {
    mockAuthUser('engineer');
    const locationRows = [
      { lat: 31.95, lng: 35.91, captured_at: '2026-04-20T08:01:00.000Z' },
      { lat: 31.96, lng: 35.92, captured_at: '2026-04-20T08:02:00.000Z' },
    ];
    const chain = makeChain({ data: locationRows, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/trips/trip-1/track', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { type: string; coordinates: number[][] };
    };
    expect(body.data.type).toBe('LineString');
    expect(body.data.coordinates).toHaveLength(2);
    expect(body.data.coordinates[0]).toEqual([35.91, 31.95]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /trips/:id/end
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /trips/:id/end', () => {
  it('returns 403 for engineer', async () => {
    mockAuthUser('engineer');
    const app = makeApp();
    const res = await app.request('/trips/trip-1/end', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 31.95, lng: 35.91 }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 409 when open inspections exist', async () => {
    mockAuthUser('driver');
    const chain = makeChain({ count: 2, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/trips/trip-1/end', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 31.95, lng: 35.91 }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/INSPECTIONS_OPEN/);
  });

  it('closes trip and advances permit to completed', async () => {
    mockAuthUser('driver');
    const closedTrip = { ...MOCK_TRIP, end_time: '2026-04-20T16:00:00.000Z', permit_id: V2 };

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ count: 0, error: null })))          // inspections check
      .mockReturnValueOnce(from(makeChain({ data: closedTrip, error: null })))  // update trip
      .mockReturnValueOnce(from(makeChain({ data: null, error: null })));       // update permit

    const app = makeApp();
    const res = await app.request('/trips/trip-1/end', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 31.95, lng: 35.91 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { end_time: string | null } };
    expect(body.success).toBe(true);
    expect(body.data.end_time).not.toBeNull();
  });

  it('returns 409 when trip not found or already ended', async () => {
    mockAuthUser('admin');
    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ count: 0, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: null, error: { message: 'No rows' } })));

    const app = makeApp();
    const res = await app.request('/trips/trip-1/end', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 31.95, lng: 35.91 }),
    });
    expect(res.status).toBe(409);
  });
});
