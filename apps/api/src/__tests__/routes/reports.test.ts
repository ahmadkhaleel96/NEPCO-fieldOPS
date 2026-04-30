import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
}));

// Web Crypto is available globally in Node 19+; polyfill for older versions
if (!globalThis.crypto?.subtle) {
  const nodeCrypto = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', {
    value: nodeCrypto.webcrypto,
    configurable: true,
  });
}

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');
const { reportsRoutes } = await import('../../routes/reports.route');

function makeApp() {
  const app = new Hono();
  app.route('/reports', reportsRoutes);
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
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  then?: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise<unknown>;
  [key: string]: unknown;
};

function makeChain(resolveWith?: unknown): MockChain {
  const chain = {} as MockChain;
  Object.assign(chain, {
    select:      vi.fn().mockImplementation(() => chain),
    insert:      vi.fn().mockImplementation(() => chain),
    eq:          vi.fn().mockImplementation(() => chain),
    gte:         vi.fn().mockImplementation(() => chain),
    lte:         vi.fn().mockImplementation(() => chain),
    range:       vi.fn().mockImplementation(() => chain),
    order:       vi.fn().mockImplementation(() => chain),
    single:      vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => chain),
    not:         vi.fn().mockImplementation(() => chain),
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

const V_REPORT = '00000000-0000-0000-0000-000000000001';

const MOCK_REPORT = {
  id: V_REPORT,
  cadence: 'monthly',
  period_start: '2026-04-01T00:00:00.000Z',
  period_end: '2026-04-30T23:59:59.000Z',
  data: { summary: {}, by_asset_type: [], by_engineer: [] },
  sha256: 'a'.repeat(64),
  pdf_url: null,
  csv_sent_at: null,
  generated_at: '2026-05-01T00:00:00.000Z',
};

const VALID_GENERATE_BODY = {
  cadence: 'monthly',
  period_start: '2026-04-01T00:00:00.000Z',
  period_end: '2026-04-30T23:59:59.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /reports
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /reports', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'No token' } as never,
    });
    const res = await makeApp().request('/reports');
    expect(res.status).toBe(401);
  });

  it('returns 403 for driver role', async () => {
    mockAuthUser('driver');
    const res = await makeApp().request('/reports', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated reports for engineer', async () => {
    mockAuthUser('engineer');
    const chain = makeChain({ data: [MOCK_REPORT], count: 1, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request('/reports', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.pagination.total).toBe(1);
  });

  it('filters by cadence when provided', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: [], count: 0, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    await makeApp().request('/reports?cadence=monthly', { headers: authHeader() });
    expect(chain.eq).toHaveBeenCalledWith('cadence', 'monthly');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /reports/:id
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /reports/:id', () => {
  it('returns 200 with full report for admin', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: MOCK_REPORT, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/reports/${V_REPORT}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { id: string } };
    expect(body.data.id).toBe(V_REPORT);
  });

  it('returns 404 when report not found', async () => {
    mockAuthUser('engineer');
    const chain = makeChain({ data: null, error: { message: 'Not found' } });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/reports/${V_REPORT}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /reports/generate
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /reports/generate', () => {
  it('returns 403 for engineer (admin only)', async () => {
    mockAuthUser('engineer');
    const res = await makeApp().request('/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_GENERATE_BODY),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for invalid body', async () => {
    mockAuthUser('admin');
    const res = await makeApp().request('/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cadence: 'unknown_cadence' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 when period_start is after period_end', async () => {
    mockAuthUser('admin');
    const res = await makeApp().request('/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cadence: 'monthly',
        period_start: '2026-04-30T00:00:00.000Z',
        period_end: '2026-04-01T00:00:00.000Z',
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 201 and stores the report', async () => {
    mockAuthUser('admin');

    const permits = [
      { status: 'completed', engineer_id: 'eng-1' },
      { status: 'incomplete', engineer_id: 'eng-2' },
    ];
    const inspections = [
      { id: 'i-1', assets: { asset_type: 'hv_tower' } },
      { id: 'i-2', assets: { asset_type: 'hv_tower' } },
    ];
    const changes = [
      { status: 'approved', reviewed_by: 'eng-1', asset_id: 'a-1' },
      { status: 'rejected', reviewed_by: null, asset_id: 'a-2' },
    ];

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: permits, error: null })))         // permits
      .mockReturnValueOnce(from(makeChain({ count: 3, error: null })))              // trips count
      .mockReturnValueOnce(from(makeChain({ data: inspections, error: null })))     // inspections
      .mockReturnValueOnce(from(makeChain({ data: changes, error: null })))         // changes
      .mockReturnValueOnce(from(makeChain({ count: 1, error: null })))              // safety_reports count
      .mockReturnValueOnce(from(makeChain({ count: 15, error: null })))             // nfc_events count
      .mockReturnValueOnce(from(makeChain({ data: MOCK_REPORT, error: null })));    // insert

    const res = await makeApp().request('/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_GENERATE_BODY),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
  });

  it('aggregates summary correctly', async () => {
    mockAuthUser('admin');

    const permits = [
      { status: 'completed', engineer_id: 'eng-1' },
      { status: 'completed', engineer_id: 'eng-1' },
      { status: 'suspended', engineer_id: 'eng-2' },
    ];

    const insertChain = makeChain({ data: MOCK_REPORT, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: permits, error: null })))
      .mockReturnValueOnce(from(makeChain({ count: 2, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: [], error: null })))
      .mockReturnValueOnce(from(makeChain({ data: [], error: null })))
      .mockReturnValueOnce(from(makeChain({ count: 0, error: null })))
      .mockReturnValueOnce(from(makeChain({ count: 5, error: null })))
      .mockReturnValueOnce(from(insertChain));

    const res = await makeApp().request('/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_GENERATE_BODY),
    });
    expect(res.status).toBe(201);

    const inserted = insertChain.insert.mock.calls[0]?.[0] as {
      data: { summary: { total_permits: number; completed_permits: number } };
    };
    expect(inserted?.data?.summary?.total_permits).toBe(3);
    expect(inserted?.data?.summary?.completed_permits).toBe(2);
  });

  it('returns 409 when report already exists for this period', async () => {
    mockAuthUser('admin');

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: [], error: null })))
      .mockReturnValueOnce(from(makeChain({ count: 0, error: null })))
      .mockReturnValueOnce(from(makeChain({ data: [], error: null })))
      .mockReturnValueOnce(from(makeChain({ data: [], error: null })))
      .mockReturnValueOnce(from(makeChain({ count: 0, error: null })))
      .mockReturnValueOnce(from(makeChain({ count: 0, error: null })))
      .mockReturnValueOnce(
        from(makeChain({ data: null, error: { message: 'unique constraint', code: '23505' } }))
      );

    const res = await makeApp().request('/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_GENERATE_BODY),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { error: { message: string } };
    expect(body.error.message).toMatch(/already exists/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /reports/:id/verify
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /reports/:id/verify', () => {
  it('returns 403 for driver', async () => {
    mockAuthUser('driver');
    const res = await makeApp().request(`/reports/${V_REPORT}/verify`, {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when report not found', async () => {
    mockAuthUser('engineer');
    const chain = makeChain({ data: null, error: { message: 'Not found' } });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/reports/${V_REPORT}/verify`, {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 and reports match=false for tampered data', async () => {
    mockAuthUser('engineer');
    const reportRow = { id: V_REPORT, data: { some: 'data' }, sha256: 'deadbeef'.repeat(8) };

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: reportRow, error: null })))  // fetch
      .mockReturnValueOnce(from(makeChain({ data: null, error: null })));      // integrity_alert insert

    const res = await makeApp().request(`/reports/${V_REPORT}/verify`, {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { match: boolean } };
    expect(body.data.match).toBe(false);
  });

  it('creates integrity alert when hash mismatch is detected', async () => {
    mockAuthUser('admin');
    const reportRow = { id: V_REPORT, data: { foo: 'bar' }, sha256: 'deadbeef'.repeat(8) };

    const alertChain = makeChain({ data: null, error: null });

    vi.mocked(supabaseAdmin.from)
      .mockReturnValueOnce(from(makeChain({ data: reportRow, error: null }))) // fetch report
      .mockReturnValueOnce(from(alertChain));                                  // insert alert

    const res = await makeApp().request(`/reports/${V_REPORT}/verify`, {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { match: boolean } };
    expect(body.data.match).toBe(false);
    expect(alertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ report_id: V_REPORT })
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /reports/:id/regenerate-pdf
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /reports/:id/regenerate-pdf', () => {
  it('returns 403 for engineer (admin only)', async () => {
    mockAuthUser('engineer');
    const res = await makeApp().request(`/reports/${V_REPORT}/regenerate-pdf`, {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when report not found', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: null, error: { message: 'Not found' } });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/reports/${V_REPORT}/regenerate-pdf`, {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 and queues PDF job', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: { id: V_REPORT, cadence: 'monthly', period_start: '2026-04-01T00:00:00.000Z', period_end: '2026-04-30T23:59:59.000Z' }, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValueOnce(from(chain));

    const res = await makeApp().request(`/reports/${V_REPORT}/regenerate-pdf`, {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { report_id: string; message: string } };
    expect(body.data.report_id).toBe(V_REPORT);
    expect(body.data.message).toMatch(/queued/i);
  });
});
