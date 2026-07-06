import { ApiClient } from '@fieldops/api-client';
import { supabase } from './supabase';

const API_BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export const apiClient = new ApiClient({ baseUrl: API_BASE_URL });

/**
 * Refresh the API client token from the current Supabase session.
 * Call this once on app start and whenever the session changes.
 */
export async function syncApiToken(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    apiClient.setAccessToken(session.access_token);
  }
}
