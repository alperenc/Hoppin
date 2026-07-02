// Pure geo helpers used to decide whether a Google Place is close enough to
// an existing venue's recorded coordinates to be treated as the same
// physical place. Extracted from api/places-refresh.ts so this logic (the
// core of the 250m anti-hijack check from PR #43) can be unit tested without
// spinning up a server or a database.

// A legitimate re-check-in at a real venue should land within a city block of
// its recorded location; anything farther is not the same physical place.
export const MAX_LINK_DISTANCE_METERS = 250;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// True when a claimed Google place is close enough to a venue's existing
// coordinates to be treated as the same physical place. Mirrors the check in
// api/places-refresh.ts: missing/non-finite existing coordinates never pass.
export function isWithinLinkDistance(
  existingLat: number,
  existingLng: number,
  candidateLat: number,
  candidateLng: number,
  maxDistanceMeters: number = MAX_LINK_DISTANCE_METERS
): boolean {
  if (!Number.isFinite(existingLat) || !Number.isFinite(existingLng)) {
    return false;
  }
  return haversineMeters(existingLat, existingLng, candidateLat, candidateLng) <= maxDistanceMeters;
}

export type VenueProviderLinkState = {
  place_provider: string | null;
  provider_place_id: string | null;
};

export type LinkEligibility =
  | { kind: 'already_linked_to_this_place' }
  | { kind: 'unlinked' }
  | { kind: 'linked_to_different_place' };

// Mirrors the routing decision at the top of api/places-refresh.ts: a venue
// already linked to a *different* place must never be reassigned by a
// refresh/link call for some other placeId (one of the 4 holes PR #43 closed
// -- a client-suppliable placeId could otherwise overwrite an existing,
// unrelated link).
export function classifyVenueProviderLink(
  venue: VenueProviderLinkState,
  claimedPlaceId: string
): LinkEligibility {
  const isAlreadyLinkedToThisPlace = venue.place_provider === 'google' && venue.provider_place_id === claimedPlaceId;
  if (isAlreadyLinkedToThisPlace) {
    return { kind: 'already_linked_to_this_place' };
  }
  const isUnlinked = !venue.provider_place_id;
  if (isUnlinked) {
    return { kind: 'unlinked' };
  }
  return { kind: 'linked_to_different_place' };
}
