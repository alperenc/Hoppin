import { LocationHint } from '../src/types/hoppin';
import { GooglePlaceDetails, fetchGooglePlaceDetails, isCityLike, resolveCity, resolveCountry } from '../src/lib/googlePlaces';
import { VercelRequestLike, VercelResponseLike, getAuthorizedUserId } from '../src/lib/vercelAuth';

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

  if (!(await getAuthorizedUserId(request))) {
    response.status(401).json({ hints: [] });
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
