import { AuthChangeEvent, AuthResponse, Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export type AuthState = {
  session: Session | null;
  user: User | null;
};

export const isAuthAvailable = isSupabaseConfigured;

export async function getAuthState(): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { session: null, user: null };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { session: null, user: null };
  }

  return {
    session: data.session,
    user: data.session?.user ?? null,
  };
}

export async function hasAuthenticatedSession(): Promise<boolean> {
  const { session } = await getAuthState();
  return Boolean(session);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Auth is unavailable until Supabase is configured.');
  }

  const response = await supabase.auth.signInWithPassword({ email, password });
  if (response.error) {
    throw response.error;
  }
  return response;
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthResponse> {
  if (!isSupabaseConfigured) {
    throw new Error('Auth is unavailable until Supabase is configured.');
  }

  const response = await supabase.auth.signUp({ email, password });
  if (response.error) {
    throw response.error;
  }
  return response;
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getAuthUserEmail(): Promise<string | undefined> {
  const { user } = await getAuthState();
  return user?.email ?? undefined;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, state: AuthState) => void
): { unsubscribe: () => void } {
  if (!isSupabaseConfigured) {
    return { unsubscribe: () => {} };
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, {
      session,
      user: session?.user ?? null,
    });
  });

  return {
    unsubscribe: () => data.subscription.unsubscribe(),
  };
}
