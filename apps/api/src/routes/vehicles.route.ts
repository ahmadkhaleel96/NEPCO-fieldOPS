import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { CreateVehicleSchema, UpdateVehicleSchema, PaginationQuerySchema } from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const vehiclesRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

vehiclesRoutes.use(authMiddleware);

/** GET /vehicles */
vehiclesRoutes.get('/', async (c) => {
  const query = PaginationQuerySchema.parse({
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  });
  const from = (query.page - 1) * query.per_page;
  const to = from + query.per_page - 1;

  const { data, count, error } = await supabaseAdmin
    .from('vehicles')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .range(from, to)
    .order('vehicle_code');

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

/** POST /vehicles */
vehiclesRoutes.post('/', requireRole('admin', 'engineer'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = CreateVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid vehicle data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .insert({ ...parsed.data, created_by: c.get('userId') })
    .select()
    .single();

  if (error) {
    if (error.message.includes('unique')) {
      throw new HTTPException(409, {
        message: 'A vehicle with this code or plate number already exists',
      });
    }
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({ success: true, data }, 201);
});

/** GET /vehicles/:id */
vehiclesRoutes.get('/:id', async (c) => {
  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error || !data) throw new HTTPException(404, { message: 'Vehicle not found' });

  return c.json({ success: true, data });
});

/** PATCH /vehicles/:id */
vehiclesRoutes.patch('/:id', requireRole('admin', 'engineer'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = UpdateVehicleSchema.safeParse(body);
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

  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .update(parsed.data)
    .eq('id', c.req.param('id'))
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ success: true, data });
});

/** DELETE /vehicles/:id — soft delete */
vehiclesRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  const { data, error } = await supabaseAdmin
    .from('vehicles')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: 'Vehicle not found' });

  return c.json({ success: true, data });
});
