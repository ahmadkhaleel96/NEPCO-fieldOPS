import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { CreateAssetSchema, UpdateAssetSchema, PaginationQuerySchema } from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

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
    .from('assets')
    .select(
      'id, asset_code, asset_type, name, metadata, is_active, created_by, created_at, updated_at, ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude',
      { count: 'exact' }
    )
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
  const createdBy = c.get('userId');

  const { data, error } = await supabaseAdmin
    .from('assets')
    .insert({
      ...rest,
      // PostGIS point: ST_SetSRID(ST_MakePoint(lng, lat), 4326)
      location: `SRID=4326;POINT(${longitude} ${latitude})`,
      created_by: createdBy,
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

/** GET /assets/:id */
assetsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('*, ST_X(location::geometry) as longitude, ST_Y(location::geometry) as latitude')
    .eq('id', id)
    .single();

  if (error || !data) throw new HTTPException(404, { message: 'Asset not found' });

  return c.json({ success: true, data });
});

/** PATCH /assets/:id */
assetsRoutes.patch('/:id', requireRole('admin', 'engineer'), async (c) => {
  const id = c.req.param('id');

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
