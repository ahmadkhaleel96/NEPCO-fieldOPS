import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const safetyReportsRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

safetyReportsRoutes.use(authMiddleware);

/** GET /safety-reports — list all safety reports */
safetyReportsRoutes.get('/', requireRole('admin', 'engineer'), async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page') ?? 20)));
  const tripId = c.req.query('trip_id');

  let query = supabaseAdmin
    .from('safety_reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (tripId) query = query.eq('trip_id', tripId);

  const { data, error, count } = await query;
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({
    success: true,
    data: data ?? [],
    pagination: {
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    },
  });
});

/** GET /safety-reports/:id */
safetyReportsRoutes.get('/:id', requireRole('admin', 'engineer'), async (c) => {
  const id = c.req.param('id');

  const { data, error } = await supabaseAdmin
    .from('safety_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: 'Safety report not found' });

  return c.json({ success: true, data });
});
