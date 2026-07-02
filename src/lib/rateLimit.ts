import type { SupabaseClient } from '@supabase/supabase-js';
import { VercelRequestLike, readHeader } from './vercelAuth';

// Vercel sets x-forwarded-for on every invocation; it may contain a chain of
// proxy hops ("client, proxy1, proxy2"), so the first entry is the original
// caller. x-real-ip is a fallback for local/non-Vercel environments.
export function getClientIp(request: VercelRequestLike): string {
  const forwardedFor = readHeader(request, 'x-forwarded-for');
  const firstHop = forwardedFor?.split(',')[0]?.trim();
  if (firstHop) return firstHop;

  const realIp = readHeader(request, 'x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}

export type RateLimitConfig = {
  bucket: string;
  windowSeconds: number;
  maxCalls: number;
};

// Calls the rate_limit_hit RPC (supabase/migrations/0009_rate_limit_rpc.sql),
// which atomically increments a fixed-window counter and self-prunes old
// windows in the same statement -- no check-then-insert race, no unbounded
// row growth, no cron job needed.
//
// Fails closed: if the RPC call itself errors (network/DB issue), the
// caller is treated as rate-limited rather than let through, matching the
// old table-based limiter's behavior on query failure.
export async function checkRateLimit(
  service: SupabaseClient,
  key: string,
  config: RateLimitConfig
): Promise<boolean> {
  const { data, error } = await service.rpc('rate_limit_hit', {
    p_bucket: config.bucket,
    p_key: key,
    p_window_seconds: config.windowSeconds,
    p_max_calls: config.maxCalls,
  });

  if (error) return false;
  return data === true;
}
