import { createClient } from '@supabase/supabase-js';

export type VercelRequestLike = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type VercelResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponseLike;
  json(body: unknown): void;
};

export const readHeader = (request: VercelRequestLike, name: string) => {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export async function getAuthorizedUserId(request: VercelRequestLike): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const token = readHeader(request, 'authorization')?.replace(/^Bearer\s+/i, '').trim();

  if (!supabaseUrl || !supabaseAnonKey || !token) {
    return null;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await client.auth.getUser(token);

  return !error && data.user ? data.user.id : null;
}
