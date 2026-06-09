import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RawEnv = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

const env = process.env as RawEnv;

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isDefaultValue = (value: string) =>
  ['https://your-project.supabase.co', 'your-anon-key'].includes(value) || value.trim() === '';

const isBrowser = typeof window !== 'undefined';

const authOptions = isBrowser
  ? {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    }
  : {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authOptions,
});

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseConfigured = isSupabaseReady && !isDefaultValue(supabaseUrl) && !isDefaultValue(supabaseAnonKey);
