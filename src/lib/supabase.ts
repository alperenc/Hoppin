import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type RawEnv = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

const env = process.env as RawEnv;

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

const isDefaultValue = (value: string) =>
  ['https://your-project.supabase.co', 'your-anon-key'].includes(value) || value.trim() === '';

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseConfigured = isSupabaseReady && !isDefaultValue(supabaseUrl) && !isDefaultValue(supabaseAnonKey);

const authOptions =
  Platform.OS === 'web'
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
