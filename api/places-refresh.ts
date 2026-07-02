import { createClient } from '@supabase/supabase-js';
import { fetchGooglePlaceDetails, resolveCity, resolveCountry } from '../src/lib/googlePlaces';
import { MAX_LINK_DISTANCE_METERS, classifyVenueProviderLink, isWithinLinkDistance } from '../src/lib/placesRefreshPolicy';
import { VercelRequestLike, VercelResponseLike, getAuthorizedUserId } from '../src/lib/vercelAuth';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A real user refreshes a handful of venues per check-in session; this is
// generous headroom for that while blocking scripted bursts.
const RATE_LIMIT_MAX_CALLS = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function parseBody(request: VercelRequestLike): { venueId?: string; placeId?: string } {
  if (!request.body) return {};
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body) as { venueId?: string; placeId?: string };
    } catch {
      return {};
    }
  }
  return request.body as { venueId?: string; placeId?: string };
}

export default async function handler(request: VercelRequestLike, response: VercelResponseLike) {
  response.setHeader('Cache-Control', 'private, no-store');

  if (request.method && request.method !== 'POST') {
    response.status(405).json({ ok: false });
    return;
  }

  const { venueId, placeId } = parseBody(request);
  if (!venueId || !uuidRegex.test(venueId) || !placeId || typeof placeId !== 'string' || placeId.length > 512) {
    response.status(400).json({ ok: false });
    return;
  }

  const userId = await getAuthorizedUserId(request);
  if (!userId) {
    response.status(401).json({ ok: false });
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    response.status(200).json({ ok: false });
    return;
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCalls, error: rateLimitError } = await service
    .from('places_refresh_calls')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .gte('created_at', windowStart);

  if (rateLimitError || (recentCalls ?? 0) >= RATE_LIMIT_MAX_CALLS) {
    response.status(429).json({ ok: false });
    return;
  }

  await service.from('places_refresh_calls').insert({ profile_id: userId });

  const { data: venue, error: venueError } = await service
    .from('venues')
    .select('id,place_provider,provider_place_id,latitude,longitude')
    .eq('id', venueId)
    .maybeSingle();

  if (venueError || !venue) {
    response.status(200).json({ ok: false });
    return;
  }

  const linkEligibility = classifyVenueProviderLink(venue, placeId);

  if (linkEligibility.kind === 'linked_to_different_place') {
    // Linked to a different place already; never reassign an existing link.
    response.status(200).json({ ok: false });
    return;
  }

  const place = await fetchGooglePlaceDetails(placeId, apiKey);
  if (!place || place.id !== placeId) {
    response.status(200).json({ ok: false });
    return;
  }

  const name = place.displayName?.text;
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  const city = resolveCity(place);
  const country = resolveCountry(place);

  if (!name || lat === undefined || lng === undefined || !city || !country) {
    response.status(200).json({ ok: false });
    return;
  }

  if (linkEligibility.kind === 'unlinked') {
    // Linking a previously-unlinked venue: require the Google place to be
    // physically close to where the venue already claims to be, so a caller
    // can't attach an unrelated real place's identity to an existing venue
    // that other users' check-ins/trails already reference.
    const existingLat = Number(venue.latitude);
    const existingLng = Number(venue.longitude);
    if (!isWithinLinkDistance(existingLat, existingLng, lat, lng, MAX_LINK_DISTANCE_METERS)) {
      response.status(200).json({ ok: false });
      return;
    }

    const { error: linkError } = await service
      .from('venues')
      .update({ place_provider: 'google', provider_place_id: placeId, name, latitude: lat, longitude: lng })
      .eq('id', venueId)
      .is('provider_place_id', null);

    response.status(200).json({ ok: !linkError });
    return;
  }

  const { error: refreshError } = await service
    .from('venues')
    .update({ name, latitude: lat, longitude: lng })
    .eq('id', venueId)
    .eq('place_provider', 'google')
    .eq('provider_place_id', placeId);

  response.status(200).json({ ok: !refreshError });
}
