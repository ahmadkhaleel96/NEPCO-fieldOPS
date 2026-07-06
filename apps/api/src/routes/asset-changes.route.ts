import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { ReviewChangeSchema } from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';
import { validateUuid } from '../lib/validate-uuid';

export const assetChangesRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

assetChangesRoutes.use(authMiddleware);

/** GET /asset-changes — list with optional status and asset_id filters (admin/engineer only) */
assetChangesRoutes.get('/', requireRole('admin', 'engineer'), async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1));
  const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page') ?? 20)));
  const status = c.req.query('status');
  const assetId = c.req.query('asset_id');
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let q = supabaseAdmin
    .from('asset_changes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) q = q.eq('status', status);
  if (assetId) q = q.eq('asset_id', assetId);

  const { data, error, count } = await q;
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

/**
 * PATCH /asset-changes/:id/approve — engineer approves a field change
 *
 * The approval triggers the on_asset_change_approved() DB trigger which:
 * 1. Updates assets.metadata (jsonb_set)
 * 2. Inserts into asset_history (append-only)
 * Both happen atomically in the trigger — the API just sets the status.
 */
assetChangesRoutes.patch('/:id/approve', requireRole('admin', 'engineer'), async (c) => {
  const id = c.req.param('id');
  validateUuid(id);

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = ReviewChangeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid review data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  // Check for conflicts: has this field been updated by a more recent approval?
  const { data: change } = await supabaseAdmin
    .from('asset_changes')
    .select('asset_id, field_name, old_value, status')
    .eq('id', id)
    .single();

  if (!change) throw new HTTPException(404, { message: 'Change not found' });

  if ((change as { status: string }).status !== 'pending') {
    throw new HTTPException(409, {
      message: 'This change has already been reviewed',
    });
  }

  // Check for prior approval of this field (conflict detection)
  const { data: priorHistory } = await supabaseAdmin
    .from('asset_history')
    .select('approved_by, approved_at')
    .eq('asset_id', (change as { asset_id: string }).asset_id)
    .eq('field_name', (change as { field_name: string }).field_name)
    .order('approved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const newStatus = parsed.data.action === 'approve' ? 'approved' : 'rejected';
  const reviewerId = c.get('userProfileId');

  const { data, error } = await supabaseAdmin
    .from('asset_changes')
    .update({
      status: newStatus,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({
    success: true,
    data,
    // Include conflict warning if another approval preceded this one
    ...(priorHistory
      ? {
          warning: `This field was previously updated at ${(priorHistory as { approved_at: string }).approved_at}. Your approval has overwritten it.`,
        }
      : {}),
  });
});
