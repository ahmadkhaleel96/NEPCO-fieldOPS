import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { ResolveFollowUpTaskSchema } from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const followUpTasksRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

followUpTasksRoutes.use(authMiddleware);

/** GET /follow-up-tasks — list tasks with optional filters */
followUpTasksRoutes.get('/', requireRole('admin', 'engineer', 'team_leader'), async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page') ?? 20)));
  const assetId = c.req.query('asset_id');
  const resolved = c.req.query('resolved');

  let query = supabaseAdmin
    .from('follow_up_tasks')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (assetId) query = query.eq('asset_id', assetId);
  if (resolved === 'true') query = query.not('resolved_at', 'is', null);
  if (resolved === 'false') query = query.is('resolved_at', null);

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

/** GET /follow-up-tasks/:id */
followUpTasksRoutes.get('/:id', requireRole('admin', 'engineer', 'team_leader'), async (c) => {
  const id = c.req.param('id');

  const { data, error } = await supabaseAdmin
    .from('follow_up_tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: 'Follow-up task not found' });

  return c.json({ success: true, data });
});

/** PATCH /follow-up-tasks/:id/resolve — mark a task resolved */
followUpTasksRoutes.patch('/:id/resolve', requireRole('admin', 'engineer', 'team_leader', 'driver'), async (c) => {
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = ResolveFollowUpTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid resolve data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('follow_up_tasks')
    .select('id, resolved_at')
    .eq('id', id)
    .maybeSingle();

  if (!existing) throw new HTTPException(404, { message: 'Follow-up task not found' });

  if ((existing as { resolved_at: string | null }).resolved_at) {
    throw new HTTPException(409, { message: 'Task is already resolved' });
  }

  const { data, error } = await supabaseAdmin
    .from('follow_up_tasks')
    .update({
      resolved_at: new Date().toISOString(),
      notes: parsed.data.notes ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw new HTTPException(500, { message: 'Failed to resolve task' });

  return c.json({ success: true, data });
});
