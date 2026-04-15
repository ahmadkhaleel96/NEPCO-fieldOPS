import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string;
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required'
  );
}

/**
 * Web Supabase client.
 * Tokens are stored in memory only — NOT in localStorage.
 * The refresh token is handled via an httpOnly cookie set by the API.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
