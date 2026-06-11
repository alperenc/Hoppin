import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { AuthChangeEvent, AuthResponse, Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type AuthState = {
  session: Session | null;
  user: User | null;
};

export type SocialAuthProvider = 'google';

export const isAuthAvailable = isSupabaseConfigured;

const oauthRedirectTo = () =>
  makeRedirectUri({
    scheme: 'hoppin',
    path: 'auth',
  });

function getOAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;

  if (hash) {
    const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?').pop() : hash);
    hashParams.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }

  return params;
}

export async function completeOAuthRedirect(url: string): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { session: null, user: null };
  }

  const params = getOAuthParams(url);
  const error = params.get('error_description') ?? params.get('error') ?? params.get('error_code');
  if (error) {
    throw new Error(error);
  }

  const code = params.get('code');
  if (code) {
    const response = await supabase.auth.exchangeCodeForSession(code);
    if (response.error) {
      throw response.error;
    }
    return {
      session: response.data.session,
      user: response.data.user,
    };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const response = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (response.error) {
      throw response.error;
    }
    return {
      session: response.data.session,
      user: response.data.user,
    };
  }

  return getAuthState();
}

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

export async function signInWithOAuthProvider(provider: SocialAuthProvider): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    throw new Error('Auth is unavailable until Supabase is configured.');
  }

  const redirectTo = oauthRedirectTo();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error('Could not start Google sign-in.');
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    return { session: null, user: null };
  }

  return completeOAuthRedirect(result.url);
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
