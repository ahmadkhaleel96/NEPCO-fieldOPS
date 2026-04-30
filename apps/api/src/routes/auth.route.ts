import { OpenAPIHono } from '@hono/zod-openapi';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { authRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { authMiddleware, requireRole, type AuthVariables } from '../middleware/auth.middleware';
import { supabaseAnon, supabaseAdmin } from '../lib/supabase';

export const authRoutes = new OpenAPIHono<{ Variables: AuthVariables }>();

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** POST /auth/signin */
authRoutes.post('/signin', authRateLimitMiddleware, async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sign-in payload',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { email, password } = parsed.data;

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  // Web: set refresh token as httpOnly cookie; return access token in body
  c.header(
    'Set-Cookie',
    `fieldops_refresh=${data.session.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=604800`
  );

  return c.json({
    success: true,
    data: {
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.app_metadata?.['role'],
      },
    },
  });
});

/** POST /auth/signout */
authRoutes.post('/signout', authMiddleware, async (c) => {
  const { error } = await supabaseAnon.auth.signOut();

  if (error) {
    throw new HTTPException(500, { message: 'Sign-out failed' });
  }

  c.header(
    'Set-Cookie',
    'fieldops_refresh=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0'
  );

  return c.json({ success: true, data: { message: 'Signed out successfully' } });
});

/** POST /auth/revoke — admin revokes all active sessions for a user (e.g. lost device) */
authRoutes.post('/revoke', authRateLimitMiddleware, authMiddleware, requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  });

  const RevokeSchema = z.object({ user_id: z.string().uuid() });
  const parsed = RevokeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'user_id must be a valid UUID',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      422
    );
  }

  const { error } = await supabaseAdmin.auth.admin.signOut(parsed.data.user_id, 'global');

  if (error) {
    throw new HTTPException(500, { message: 'Session revocation failed' });
  }

  return c.json({ success: true, data: { message: 'All sessions revoked for user' } });
});

/** POST /auth/refresh — exchanges refresh token cookie for new access token */
authRoutes.post('/refresh', authRateLimitMiddleware, async (c) => {
  const cookieHeader = c.req.header('Cookie') ?? '';
  const match = cookieHeader.match(/fieldops_refresh=([^;]+)/);
  const refreshToken = match?.[1];

  if (!refreshToken) {
    throw new HTTPException(401, { message: 'No refresh token provided' });
  }

  const { data, error } = await supabaseAnon.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new HTTPException(401, { message: 'Invalid or expired refresh token' });
  }

  // Rotate the refresh token cookie
  c.header(
    'Set-Cookie',
    `fieldops_refresh=${data.session.refresh_token}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=604800`
  );

  return c.json({
    success: true,
    data: {
      access_token: data.session.access_token,
      expires_in: data.session.expires_in,
    },
  });
});
