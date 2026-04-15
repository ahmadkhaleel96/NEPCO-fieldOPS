import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import {
  CreateUserSchema,
  UpdateUserSchema,
  PaginationQuerySchema,
} from '@fieldops/shared';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAdmin } from '../lib/supabase';

export const usersRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

// All user routes require authentication
usersRoutes.use(authMiddleware);

/** GET /users — list all users (admin + engineer) */
usersRoutes.get('/', requireRole('admin', 'engineer'), async (c) => {
  const query = PaginationQuerySchema.parse({
    page: c.req.query('page'),
    per_page: c.req.query('per_page'),
  });

  const from = (query.page - 1) * query.per_page;
  const to = from + query.per_page - 1;

  const { data, count, error } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false });

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

/** POST /users — create a user (admin only) */
usersRoutes.post('/', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user data',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { email, full_name, role, phone } = parsed.data;

  // Create in Supabase Auth (server-side only — never from client)
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role },
    });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already')) {
      throw new HTTPException(409, { message: 'A user with this email already exists' });
    }
    throw new HTTPException(500, { message: authError?.message ?? 'Auth creation failed' });
  }

  // Create the matching users row in a single transaction
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({
      auth_id: authData.user.id,
      email,
      full_name,
      role,
      phone: phone ?? null,
    })
    .select()
    .single();

  if (error) {
    // Roll back auth user on failure
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw new HTTPException(500, { message: error.message });
  }

  return c.json({ success: true, data }, 201);
});

/** GET /users/:id */
usersRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const requesterId = c.get('userId');
  const requesterRole = c.get('userRole');

  // Users can only fetch their own record unless they are admin/engineer
  if (id !== requesterId && !['admin', 'engineer'].includes(requesterRole)) {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new HTTPException(404, { message: 'User not found' });

  return c.json({ success: true, data });
});

/** PATCH /users/:id */
usersRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const requesterId = c.get('userId');
  const requesterRole = c.get('userRole');

  if (id !== requesterId && requesterRole !== 'admin') {
    throw new HTTPException(403, { message: 'Access denied' });
  }

  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = UpdateUserSchema.safeParse(body);
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
    .from('users')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ success: true, data });
});

/** DELETE /users/:id — soft delete (sets is_active = false) */
usersRoutes.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ success: true, data });
});
