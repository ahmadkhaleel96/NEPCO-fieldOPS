import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { UserRole } from '@fieldops/shared';
import { supabaseAnon } from '../lib/supabase';

export type AuthVariables = {
  userId: string;
  userRole: UserRole;
  userEmail: string;
};

/**
 * JWT authentication middleware.
 *
 * Validates the Bearer token from the Authorization header using Supabase Auth.
 * On success, injects userId, userRole, and userEmail into the Hono context.
 * On failure, returns 401 Unauthorized.
 *
 * The `role` claim is injected into the JWT by the Supabase Auth hook
 * (infra/migrations/018_create_auth_hook.sql) — it is never set by the client.
 */
export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, {
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.slice(7);

    const { data, error } = await supabaseAnon.auth.getUser(token);

    if (error || !data.user) {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }

    const user = data.user;
    const role = user.app_metadata?.['role'] as UserRole | undefined;

    if (!role) {
      throw new HTTPException(403, {
        message: 'User has no assigned role — contact your administrator',
      });
    }

    c.set('userId', user.id);
    c.set('userRole', role);
    c.set('userEmail', user.email ?? '');

    await next();
  }
);

/**
 * Role guard factory — call after authMiddleware.
 *
 * @example
 * app.use('/admin/*', authMiddleware, requireRole('admin'))
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const role = c.get('userRole');

    if (!allowedRoles.includes(role)) {
      throw new HTTPException(403, {
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }

    await next();
  });
}
