import { createClient } from '@supabase/supabase-js';
import { LocationHint } from '../src/types/hoppin';
import { GooglePlaceDetails, fetchGooglePlaceDetails, isCityLike, resolveCity, resolveCountry } from '../src/lib/googlePlaces';
import { VercelRequestLike, VercelResponseLike, getAuthorizedUserId } from '../src/lib/vercelAuth';
import { checkRateLimit, getClientIp } from '../src/lib/rateLimit';

// This endpoint is a thin proxy in front of paid Google Places calls
// (autocomplete + nearby + details, up to several Google requests per hit);
// it predates any rate limiting (see issue #45). Callers search-as-they-type,
// so the per-user budget is generous, but still bounded well below what a
// scripted client could otherwise sustain.
const RATE_LIMIT_MAX_CALLS = 60;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

// Looser IP bound: catches a single IP cycling through many accounts without
// punishing shared IPs under normal per-user use.
const RATE_LIMIT_IP_MAX_CALLS = 180;

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      place?: string;
      placeId?: string;
    };
  }>;
};

type GoogleNearbyResponse = {
  places?: GooglePlaceDetails[];
};

const NEARBY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.location',
  'places.addressComponents',
  'places.types',
].join(',');

const nearbyIncludedTypes = ['brewery', 'brewpub', 'beer_garden', 'pub', 'bar', 'restaurant', 'cafe', 'night_club'];

const toHint = (place: GooglePlaceDetails): LocationHint | null => {
  const city = resolveCity(place);
  const country = resolveCountry(place);
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  if (!city || !country || lat === undefined || lng === undefined) {
    return null;
  }

  const externalId = place.id;
  const cityOnly = isCityLike(place.types);

  return {
    venueName: cityOnly ? undefined : place.displayName?.text,
    city,
    country,
    lat,
    lng,
    provider: 'google',
    externalId,
  };
};

const uniqueHints = (hints: LocationHint[]) => {
  const seen = new Set<string>();
  const unique: LocationHint[] = [];

  for (const hint of hints) {
    const key = `${hint.provider ?? 'user'}:${hint.externalId ?? ''}:${hint.venueName ?? ''}:${hint.city ?? ''}:${hint.country ?? ''}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(hint);
    }
  }

  return unique;
};

export default async function handler(request: VercelRequestLike, response: VercelResponseLike) {
  response.setHeader('Cache-Control', 'private, no-store');

  if (request.method && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawQuery = request.query?.query;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
  const input = query?.trim().slice(0, 120) ?? '';
  const rawLat = request.query?.lat;
  const rawLng = request.query?.lng;
  const latitude = Number(Array.isArray(rawLat) ? rawLat[0] : rawLat);
  const longitude = Number(Array.isArray(rawLng) ? rawLng[0] : rawLng);
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  if (input.length < 2 && !hasCoordinates) {
    response.status(200).json({ hints: [] });
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim();

  if (!apiKey) {
    response.status(200).json({ hints: [] });
    return;
  }

  const userId = await getAuthorizedUserId(request);
  if (!userId) {
    response.status(401).json({ hints: [] });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(200).json({ hints: [] });
    return;
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const [withinUserLimit, withinIpLimit] = await Promise.all([
    checkRateLimit(service, userId, {
      bucket: 'places:user',
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      maxCalls: RATE_LIMIT_MAX_CALLS,
    }),
    checkRateLimit(service, getClientIp(request), {
      bucket: 'places:ip',
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
      maxCalls: RATE_LIMIT_IP_MAX_CALLS,
    }),
  ]);

  if (!withinUserLimit || !withinIpLimit) {
    response.status(429).json({ hints: [] });
    return;
  }

  try {
    if (hasCoordinates) {
      const nearbyResponse = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': NEARBY_FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: nearbyIncludedTypes,
          maxResultCount: 5,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: {
                latitude,
                longitude,
              },
              radius: 120,
            },
          },
        }),
      });

      if (!nearbyResponse.ok) {
        response.status(200).json({ hints: [] });
        return;
      }

      const nearby = (await nearbyResponse.json()) as GoogleNearbyResponse;
      response.status(200).json({
        hints: uniqueHints((nearby.places ?? []).map(toHint).filter((hint): hint is LocationHint => Boolean(hint))).slice(0, 5),
      });
      return;
    }

    const autocompleteResponse = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId',
      },
      body: JSON.stringify({
        input,
        includeQueryPredictions: false,
      }),
    });

    if (!autocompleteResponse.ok) {
      response.status(200).json({ hints: [] });
      return;
    }

    const autocomplete = (await autocompleteResponse.json()) as GoogleAutocompleteResponse;
    const placeIds = uniqueHints(
      (autocomplete.suggestions ?? [])
        .map((suggestion) => suggestion.placePrediction?.placeId ?? suggestion.placePrediction?.place?.replace(/^places\//, ''))
        .filter((placeId): placeId is string => Boolean(placeId))
        .slice(0, 5)
        .map((externalId) => ({ externalId }))
    ).map((hint) => hint.externalId as string);

    const details = await Promise.all(placeIds.map((placeId) => fetchGooglePlaceDetails(placeId, apiKey)));

    response.status(200).json({
      hints: uniqueHints(details.map((place) => (place ? toHint(place) : null)).filter((hint): hint is LocationHint => Boolean(hint))).slice(0, 5),
    });
  } catch {
    response.status(200).json({ hints: [] });
  }
}
