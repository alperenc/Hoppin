import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

const isDefaultValue = (value: string) =>
  ['https://your-project.supabase.co', 'your-anon-key'].includes(value) || value.trim() === '';

const resolveSupabaseProjectRef = (url: string) => {
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return '';
  }
};

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseConfigured = isSupabaseReady && !isDefaultValue(supabaseUrl) && !isDefaultValue(supabaseAnonKey);
export const supabaseAuthStorageKey = `sb-${resolveSupabaseProjectRef(supabaseUrl)}-auth-token`;

const authOptions =
  Platform.OS === 'web'
    ? {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: supabaseAuthStorageKey,
      }
    : {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: supabaseAuthStorageKey,
      };

const supabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: authOptions,
    })
  : null;

export const supabase =
  supabaseClient ??
  new Proxy({} as SupabaseClient, {
    get() {
      throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    },
  });

export async function clearSupabaseAuthStorage(): Promise<void> {
  if (!supabaseAuthStorageKey || supabaseAuthStorageKey === 'sb--auth-token') {
    return;
  }

  const keys = [supabaseAuthStorageKey, `${supabaseAuthStorageKey}-code-verifier`];

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    keys.forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
    return;
  }

  await AsyncStorage.multiRemove(keys);
}
