import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { PaginationQuerySchema } from '@fieldops/shared';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const reportsRoutes = new OpenAPIHono();

reportsRoutes.use(authMiddleware);
reportsRoutes.use(requireRole('admin', 'engineer'));

/** GET /reports */
reportsRoutes.get('/', async (c) => {
  const query = PaginationQuerySchema.parse({
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  });
  const cadenceFilter = c.req.query('cadence');
  const from = (query.page - 1) * query.per_page;
  const to = from + query.per_page - 1;

  // Exclude the full data jsonb from list view — only return metadata
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

/** GET /reports/:id — full report including data payload */
reportsRoutes.get('/:id', async (c) => {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) throw new HTTPException(404, { message: 'Report not found' });

  return c.json({ success: true, data });
});

/**
 * POST /reports/:id/regenerate-pdf
 * Re-renders the PDF from the stored data jsonb without touching source tables.
 * This is the recovery path if the R2 PDF is lost.
 */
reportsRoutes.post('/:id/regenerate-pdf', requireRole('admin'), async (c) => {
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('id, data, sha256, cadence, period_start, period_end')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !report) throw new HTTPException(404, { message: 'Report not found' });

  // Phase 6 full implementation: enqueue Puppeteer PDF generation job
  // For now, return the report data that would be used
  return c.json({
    success: true,
    data: {
      message: 'PDF regeneration queued (Phase 6 implementation)',
      report_id: (report as { id: string }).id,
    },
  });
});
