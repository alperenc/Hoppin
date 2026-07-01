export type GooglePlaceDetails = {
  id?: string;
  displayName?: {
    text?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  types?: string[];
};

export const DETAILS_FIELD_MASK = ['id', 'displayName', 'location', 'addressComponents', 'types'].join(',');

export async function fetchGooglePlaceDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetails | null> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAILS_FIELD_MASK,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GooglePlaceDetails;
}

const componentByType = (place: GooglePlaceDetails, type: string) =>
  place.addressComponents?.find((component) => component.types?.includes(type));

export const isCityLike = (types: string[] = []) =>
  types.some((type) =>
    ['locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2'].includes(type)
  );

export const resolveCity = (place: GooglePlaceDetails) =>
  componentByType(place, 'locality')?.longText ??
  componentByType(place, 'postal_town')?.longText ??
  componentByType(place, 'administrative_area_level_3')?.longText ??
  componentByType(place, 'administrative_area_level_2')?.longText;

export const resolveCountry = (place: GooglePlaceDetails) =>
  componentByType(place, 'country')?.longText ?? componentByType(place, 'country')?.shortText;
