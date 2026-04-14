import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * Anon client — used to validate user JWTs.
 * Has the permissions of an authenticated user (subject to RLS).
 */
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionFromUrl: false,
  },
});

/**
 * Service-role client — bypasses RLS.
 * Used ONLY by background jobs (report generation, notification dispatch).
 * NEVER exposed to any client or returned in API responses.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionFromUrl: false,
  },
});
