import { createClient } from '@supabase/supabase-js';
import { fetchGooglePlaceDetails, resolveCity, resolveCountry } from '../src/lib/googlePlaces';
import { VercelRequestLike, VercelResponseLike, getAuthorizedUserId } from '../src/lib/vercelAuth';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Confirm the venue is currently linked to the exact Google place the caller
  // claims to be refreshing, before spending a Places API call on it.
  const { data: venue, error: venueError } = await service
    .from('venues')
    .select('id,place_provider,provider_place_id')
    .eq('id', venueId)
    .eq('place_provider', 'google')
    .eq('provider_place_id', placeId)
    .maybeSingle();

  if (venueError || !venue) {
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

  const { error: updateError } = await service
    .from('venues')
    .update({ name, latitude: lat, longitude: lng })
    .eq('id', venueId)
    .eq('place_provider', 'google')
    .eq('provider_place_id', placeId);

  response.status(200).json({ ok: !updateError });
}
