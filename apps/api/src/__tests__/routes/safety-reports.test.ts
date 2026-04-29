import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../../middleware/error.middleware';

vi.mock('../../lib/supabase', () => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
}));

const { supabaseAnon, supabaseAdmin } = await import('../../lib/supabase');
const { safetyReportsRoutes } = await import('../../routes/safety-reports.route');

function makeApp() {
  const app = new Hono();
  app.route('/safety-reports', safetyReportsRoutes);
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
  eq: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then?: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise<unknown>;
  [key: string]: unknown;
};

function makeChain(resolveWith?: unknown): MockChain {
  const chain = {} as MockChain;
  Object.assign(chain, {
    select:      vi.fn().mockImplementation(() => chain),
    eq:          vi.fn().mockImplementation(() => chain),
    range:       vi.fn().mockImplementation(() => chain),
    order:       vi.fn().mockImplementation(() => chain),
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

const REPORT_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_REPORT = {
  id: REPORT_ID,
  report_number: 'SAF-2026-0001',
  inspection_id: '00000000-0000-0000-0000-000000000002',
  trip_id: '00000000-0000-0000-0000-000000000003',
  reported_by: '00000000-0000-0000-0000-000000000004',
  hazard_description: 'Exposed high-voltage cable near access gate',
  photo_urls: ['https://cdn.example.com/photo1.jpg'],
  created_at: '2026-04-22T10:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /safety-reports
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /safety-reports', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'No token' },
    } as Awaited<ReturnType<typeof supabaseAnon.auth.getUser>>);

    const app = makeApp();
    const res = await app.request('/safety-reports');
    expect(res.status).toBe(401);
  });

  it('returns 403 for driver role', async () => {
    mockAuthUser('driver');
    const app = makeApp();
    const res = await app.request('/safety-reports', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 403 for team_leader role', async () => {
    mockAuthUser('team_leader');
    const app = makeApp();
    const res = await app.request('/safety-reports', { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated reports for admin', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: [MOCK_REPORT], count: 1, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/safety-reports', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_REPORT[]; pagination: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('returns 200 with paginated reports for engineer', async () => {
    mockAuthUser('engineer');
    const chain = makeChain({ data: [MOCK_REPORT], count: 1, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request('/safety-reports', { headers: authHeader() });
    expect(res.status).toBe(200);
  });

  it('filters by trip_id', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: [MOCK_REPORT], count: 1, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const tripId = MOCK_REPORT.trip_id;
    const res = await app.request(`/safety-reports?trip_id=${tripId}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith('trip_id', tripId);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /safety-reports/:id
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /safety-reports/:id', () => {
  it('returns 200 with report data', async () => {
    mockAuthUser('engineer');
    const chain = makeChain({ data: MOCK_REPORT, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request(`/safety-reports/${REPORT_ID}`, { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: typeof MOCK_REPORT };
    expect(body.data.report_number).toBe('SAF-2026-0001');
  });

  it('returns 403 for driver role', async () => {
    mockAuthUser('driver');
    const app = makeApp();
    const res = await app.request(`/safety-reports/${REPORT_ID}`, { headers: authHeader() });
    expect(res.status).toBe(403);
  });

  it('returns 404 when report not found', async () => {
    mockAuthUser('admin');
    const chain = makeChain({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue(from(chain));

    const app = makeApp();
    const res = await app.request(`/safety-reports/${REPORT_ID}`, { headers: authHeader() });
    expect(res.status).toBe(404);
  });
});
