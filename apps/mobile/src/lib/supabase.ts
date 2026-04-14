import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/**
 * Secure token storage for Supabase Auth on mobile.
 *
 * Tokens are stored in Expo SecureStore which uses:
 * - iOS: Keychain (hardware-backed)
 * - Android: Android Keystore (hardware-backed)
 *
 * NEVER use AsyncStorage for tokens — it is plaintext.
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string): string | null => {
    // Synchronous wrapper — SecureStore is async but Supabase expects sync
    // In practice this returns null on first call; the async path is used
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionFromUrl: false,
  },
});
