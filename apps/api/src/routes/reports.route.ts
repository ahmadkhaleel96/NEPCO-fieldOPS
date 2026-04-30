import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { PaginationQuerySchema, GenerateReportSchema, type ReportData } from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';
import { reportGenerationRateLimiter } from '../lib/redis';
import { validateUuid } from '../lib/validate-uuid';

export const reportsRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

reportsRoutes.use(authMiddleware);
reportsRoutes.use(requireRole('admin', 'engineer'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function computeHash(data: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalJson(data));
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const VALID_CADENCES = new Set(['daily', 'weekly', 'monthly', 'quarterly', 'bi_yearly', 'yearly']);

// ─── GET /reports ─────────────────────────────────────────────────────────────

reportsRoutes.get('/', async (c) => {
  const query = PaginationQuerySchema.parse({
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  });
  const cadenceFilter = c.req.query('cadence');

  if (cadenceFilter && !VALID_CADENCES.has(cadenceFilter)) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid cadence. Must be one of: ${[...VALID_CADENCES].join(', ')}` } },
      422
    );
  }
  const from = (query.page - 1) * query.per_page;
  const to = from + query.per_page - 1;

  let q = supabaseAdmin
    .from('reports')
    .select('id, cadence, period_start, period_end, sha256, pdf_url, csv_sent_at, generated_at', {
      count: 'exact',
    })
    .range(from, to)
    .order('generated_at', { ascending: false });

  if (cadenceFilter) q = q.eq('cadence', cadenceFilter);

  const { data, count, error } = await q;
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({
    success: true,
    data,
    pagination: {
      total: count ?? 0,
      page: query.page,
      per_page: query.per_page,
      total_pages: Math.ceil((count ?? 0) / query.per_page),
    },
  });
});

// ─── GET /reports/:id ─────────────────────────────────────────────────────────

reportsRoutes.get('/:id', async (c) => {
  validateUuid(c.req.param('id'));
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) throw new HTTPException(404, { message: 'Report not found' });

  return c.json({ success: true, data });
});

// ─── POST /reports/generate ───────────────────────────────────────────────────

reportsRoutes.post('/generate', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = GenerateReportSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid report parameters',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { cadence, period_start: periodStart, period_end: periodEnd } = parsed.data;

  // Per-user rate limit: 2 report generations per 60 seconds
  const userId = c.get('userId');
  const { success: rateLimitOk, reset } = await reportGenerationRateLimiter.limit(userId);
  if (!rateLimitOk) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    c.header('Retry-After', String(retryAfter));
    throw new HTTPException(429, {
      message: 'Report generation rate limit exceeded. Please wait before generating another report.',
    });
  }

  // ── Step 1: Permits in period ──────────────────────────────────────────────
  const { data: permits } = await supabaseAdmin
    .from('work_permits')
    .select('status, engineer_id')
    .gte('scheduled_start', periodStart)
    .lte('scheduled_start', periodEnd);

  const permitsArr = (permits ?? []) as Array<{ status: string; engineer_id: string }>;
  const totalPermits = permitsArr.length;
  const completedPermits = permitsArr.filter((p) => p.status === 'completed').length;
  const incompletePermits = permitsArr.filter((p) => p.status === 'incomplete').length;
  const suspendedPermits = permitsArr.filter((p) => p.status === 'suspended').length;

  // ── Step 2: Trips in period ───────────────────────────────────────────────
  const { count: totalTrips } = await supabaseAdmin
    .from('trips')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', periodStart)
    .lte('start_time', periodEnd);

  // ── Step 3: Inspections with asset type ────────────────────────────────────
  const { data: inspections } = await supabaseAdmin
    .from('asset_inspections')
    .select('id, assets(asset_type)')
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const inspectionsArr = (inspections ?? []) as Array<{
    id: string;
    assets: { asset_type: string } | null;
  }>;
  const totalInspections = inspectionsArr.length;

  // ── Step 4: Changes in period ─────────────────────────────────────────────
  const { data: changes } = await supabaseAdmin
    .from('asset_changes')
    .select('status, reviewed_by, asset_id')
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  const changesArr = (changes ?? []) as Array<{
    status: string;
    reviewed_by: string | null;
    asset_id: string;
  }>;
  const approvedChanges = changesArr.filter((c) => c.status === 'approved').length;
  const rejectedChanges = changesArr.filter((c) => c.status === 'rejected').length;

  // ── Step 5: Safety reports count ──────────────────────────────────────────
  const { count: safetyCount } = await supabaseAdmin
    .from('safety_reports')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  // ── Step 6: NFC events count ──────────────────────────────────────────────
  const { count: nfcCount } = await supabaseAdmin
    .from('nfc_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  // ── Build by_asset_type ───────────────────────────────────────────────────
  const assetTypeMap = new Map<string, { inspection_count: number; change_count: number }>();
  for (const insp of inspectionsArr) {
    const type = insp.assets?.asset_type ?? 'unknown';
    const entry = assetTypeMap.get(type) ?? { inspection_count: 0, change_count: 0 };
    entry.inspection_count++;
    assetTypeMap.set(type, entry);
  }
  const byAssetType = Array.from(assetTypeMap.entries()).map(([asset_type, counts]) => ({
    asset_type,
    ...counts,
  }));

  // ── Build by_engineer ─────────────────────────────────────────────────────
  const engineerMap = new Map<string, { permit_count: number; approval_count: number }>();
  for (const permit of permitsArr) {
    if (!permit.engineer_id) continue;
    const entry = engineerMap.get(permit.engineer_id) ?? { permit_count: 0, approval_count: 0 };
    entry.permit_count++;
    engineerMap.set(permit.engineer_id, entry);
  }
  for (const change of changesArr) {
    if (change.status === 'approved' && change.reviewed_by) {
      const entry = engineerMap.get(change.reviewed_by) ?? { permit_count: 0, approval_count: 0 };
      entry.approval_count++;
      engineerMap.set(change.reviewed_by, entry);
    }
  }
  const byEngineer = Array.from(engineerMap.entries()).map(([engineer_id, counts]) => ({
    engineer_id,
    ...counts,
  }));

  // ── Assemble & hash ───────────────────────────────────────────────────────
  const reportData: ReportData = {
    period_start: periodStart,
    period_end: periodEnd,
    cadence,
    summary: {
      total_permits: totalPermits,
      completed_permits: completedPermits,
      incomplete_permits: incompletePermits,
      suspended_permits: suspendedPermits,
      total_trips: totalTrips ?? 0,
      total_inspections: totalInspections,
      approved_changes: approvedChanges,
      rejected_changes: rejectedChanges,
      safety_reports: safetyCount ?? 0,
      total_nfc_events: nfcCount ?? 0,
    },
    by_asset_type: byAssetType,
    by_engineer: byEngineer,
  };

  const sha256 = await computeHash(reportData);

  // ── Insert ────────────────────────────────────────────────────────────────
  const { data: report, error: insertError } = await supabaseAdmin
    .from('reports')
    .insert({ cadence, period_start: periodStart, period_end: periodEnd, data: reportData, sha256 })
    .select()
    .single();

  if (insertError) {
    if (insertError.message.toLowerCase().includes('unique') || insertError.code === '23505') {
      throw new HTTPException(409, {
        message: 'Report already exists for this cadence and period',
      });
    }
    throw new HTTPException(500, { message: insertError.message });
  }

  return c.json({ success: true, data: report }, 201);
});

// ─── POST /reports/:id/verify ─────────────────────────────────────────────────

reportsRoutes.post('/:id/verify', async (c) => {
  validateUuid(c.req.param('id'));
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('id, data, sha256')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !report) throw new HTTPException(404, { message: 'Report not found' });

  const r = report as { id: string; data: unknown; sha256: string };
  const actualHash = await computeHash(r.data);
  const match = actualHash === r.sha256;

  if (!match) {
    await supabaseAdmin.from('integrity_alerts').insert({
      report_id: r.id,
      stored_hash: r.sha256,
      actual_hash: actualHash,
    });
  }

  return c.json({
    success: true,
    data: { report_id: r.id, match, stored_hash: r.sha256, actual_hash: actualHash },
  });
});

// ─── POST /reports/:id/regenerate-pdf ─────────────────────────────────────────

reportsRoutes.post('/:id/regenerate-pdf', requireRole('admin'), async (c) => {
  validateUuid(c.req.param('id'));
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('id, cadence, period_start, period_end')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !report) throw new HTTPException(404, { message: 'Report not found' });

  // Production: enqueue Puppeteer PDF generation via BullMQ, upload to Cloudflare R2
  return c.json({
    success: true,
    data: {
      report_id: (report as { id: string }).id,
      message: 'PDF regeneration queued',
    },
  });
});
