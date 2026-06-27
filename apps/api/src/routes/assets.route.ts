import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { CreateAssetSchema, UpdateAssetSchema, PaginationQuerySchema, AssetCsvRowSchema } from '@fieldops/shared';
import { z } from 'zod';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';
import { validateUuid } from '../lib/validate-uuid';

export const assetsRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

assetsRoutes.use(authMiddleware);

/** GET /assets */
assetsRoutes.get('/', async (c) => {
  const query = PaginationQuerySchema.parse({
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  });
  const typeFilter = c.req.query('asset_type');

  const from = (query.page - 1) * query.per_page;
  const to = from + query.per_page - 1;

  let q = supabaseAdmin
    .from('assets_view')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .range(from, to)
    .order('created_at', { ascending: false });

  if (typeFilter) {
    q = q.eq('asset_type', typeFilter);
  }

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

/** POST /assets */
assetsRoutes.post('/', requireRole('admin', 'engineer'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = CreateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid asset data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { latitude, longitude, ...rest } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from('assets')
    .insert({
      ...rest,
      // PostGIS point: ST_SetSRID(ST_MakePoint(lng, lat), 4326)
      location: `SRID=4326;POINT(${longitude} ${latitude})`,
      created_by: c.get('userProfileId'),
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('unique')) {
      throw new HTTPException(409, { message: 'An asset with this code already exists' });
    }
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({ success: true, data }, 201);
});

/** POST /assets/bulk-import — insert multiple assets from a CSV upload (admin, engineer) */
assetsRoutes.post('/bulk-import', requireRole('admin', 'engineer'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = z.object({ rows: z.array(z.unknown()) }).safeParse(body);
  if (!parsed.success || parsed.data.rows.length === 0) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'rows must be a non-empty array' } },
      422
    );
  }

  const validRows: Array<{ asset_code: string; asset_type: string; name: string; latitude: number; longitude: number }> = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const result = AssetCsvRowSchema.safeParse(parsed.data.rows[i]);
    if (result.success) {
      validRows.push(result.data);
    } else {
      const msg = result.error.errors.map((e) => e.message).join('; ');
      errors.push({ row: i + 1, message: msg });
    }
  }

  if (validRows.length === 0) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid rows to import', details: errors } }, 422);
  }

  const createdBy = c.get('userProfileId');
  const insertRows = validRows.map((r) => ({
    asset_code: r.asset_code,
    asset_type: r.asset_type,
    name: r.name,
    location: `SRID=4326;POINT(${r.longitude} ${r.latitude})`,
    metadata: {},
    created_by: createdBy,
  }));

  const { data, error } = await supabaseAdmin
    .from('assets')
    .upsert(insertRows, { onConflict: 'asset_code', ignoreDuplicates: true })
    .select('id');

  if (error) throw new HTTPException(500, { message: error.message });

  const imported = data?.length ?? 0;
  const skipped = validRows.length - imported;

  return c.json({ success: true, data: { imported, skipped, errors } });
});

/** GET /assets/:id */
assetsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  validateUuid(id);

  const { data, error } = await supabaseAdmin
    .from('assets_view')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new HTTPException(404, { message: 'Asset not found' });

  return c.json({ success: true, data });
});

/** PATCH /assets/:id */
assetsRoutes.patch('/:id', requireRole('admin', 'engineer'), async (c) => {
  const id = c.req.param('id');
  validateUuid(id);

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = UpdateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { latitude, longitude, ...rest } = parsed.data;
  const updatePayload: Record<string, unknown> = { ...rest };

  if (latitude !== undefined && longitude !== undefined) {
    updatePayload['location'] = `SRID=4326;POINT(${longitude} ${latitude})`;
  }

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ success: true, data });
});

/** DELETE /assets/:id — soft delete (set is_active = false) */
assetsRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  validateUuid(id);

  const { data, error } = await supabaseAdmin
    .from('assets')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: 'Asset not found' });

  return c.json({ success: true, data });
});
