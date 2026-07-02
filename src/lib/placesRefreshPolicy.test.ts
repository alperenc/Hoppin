import { describe, expect, it } from 'vitest';
import {
  MAX_LINK_DISTANCE_METERS,
  classifyVenueProviderLink,
  haversineMeters,
  isWithinLinkDistance,
} from './placesRefreshPolicy';

// Regression coverage for the 250m anti-hijack proximity check introduced in
// PR #43 (see supabase/migrations/0007_venue_column_scope_guard.sql and
// api/places-refresh.ts). Tracked by GitHub issue #44: this is the pure,
// DB-free half of that issue's requested coverage -- the RLS/trigger half
// lives in supabase/tests/venues_column_scope_guard.test.sql.

describe('haversineMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineMeters(40.7128, -74.006, 40.7128, -74.006)).toBeCloseTo(0, 3);
  });

  it('matches a known real-world distance (NYC to Philadelphia, ~130km)', () => {
    const distance = haversineMeters(40.7128, -74.006, 39.9526, -75.1652);
    expect(distance).toBeGreaterThan(125000);
    expect(distance).toBeLessThan(135000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(51.5074, -0.1278, 48.8566, 2.3522);
    const b = haversineMeters(48.8566, 2.3522, 51.5074, -0.1278);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('isWithinLinkDistance', () => {
  const venueLat = 40.7128;
  const venueLng = -74.006;

  it('accepts a place at the exact same coordinates', () => {
    expect(isWithinLinkDistance(venueLat, venueLng, venueLat, venueLng)).toBe(true);
  });

  it('accepts a place just under the 250m threshold', () => {
    // ~0.002 degrees latitude is roughly 222m; comfortably inside 250m.
    const candidateLat = venueLat + 0.002;
    expect(haversineMeters(venueLat, venueLng, candidateLat, venueLng)).toBeLessThan(MAX_LINK_DISTANCE_METERS);
    expect(isWithinLinkDistance(venueLat, venueLng, candidateLat, venueLng)).toBe(true);
  });

  it('rejects a place just over the 250m threshold', () => {
    // ~0.004 degrees latitude is roughly 444m; clearly outside 250m.
    const candidateLat = venueLat + 0.004;
    expect(haversineMeters(venueLat, venueLng, candidateLat, venueLng)).toBeGreaterThan(MAX_LINK_DISTANCE_METERS);
    expect(isWithinLinkDistance(venueLat, venueLng, candidateLat, venueLng)).toBe(false);
  });

  it('rejects a place far away (different city)', () => {
    // Boston, roughly 300km from the NYC venue coordinates above.
    expect(isWithinLinkDistance(venueLat, venueLng, 42.3601, -71.0589)).toBe(false);
  });

  it('rejects when existing venue coordinates are NaN', () => {
    expect(isWithinLinkDistance(NaN, NaN, venueLat, venueLng)).toBe(false);
  });

  it('rejects when existing venue coordinates are not finite (Infinity)', () => {
    expect(isWithinLinkDistance(Infinity, -Infinity, venueLat, venueLng)).toBe(false);
  });

  it('honors a custom maxDistanceMeters override', () => {
    const candidateLat = venueLat + 0.002; // ~222m away
    expect(isWithinLinkDistance(venueLat, venueLng, candidateLat, venueLng, 100)).toBe(false);
    expect(isWithinLinkDistance(venueLat, venueLng, candidateLat, venueLng, 300)).toBe(true);
  });
});

describe('classifyVenueProviderLink', () => {
  const claimedPlaceId = 'places/claimed-place';
  const otherPlaceId = 'places/other-place';

  it('classifies a venue already linked to the claimed place as already_linked_to_this_place', () => {
    const venue = { place_provider: 'google', provider_place_id: claimedPlaceId };
    expect(classifyVenueProviderLink(venue, claimedPlaceId)).toEqual({ kind: 'already_linked_to_this_place' });
  });

  it('classifies an unlinked venue (null provider_place_id) as unlinked', () => {
    const venue = { place_provider: 'google', provider_place_id: null };
    expect(classifyVenueProviderLink(venue, claimedPlaceId)).toEqual({ kind: 'unlinked' });
  });

  it('classifies an unlinked venue (empty-string provider_place_id) as unlinked', () => {
    const venue = { place_provider: 'google', provider_place_id: '' };
    expect(classifyVenueProviderLink(venue, claimedPlaceId)).toEqual({ kind: 'unlinked' });
  });

  it('classifies a venue linked to a different exact place_id as linked_to_different_place', () => {
    // Regression for the "refresh a venue not linked to the exact claimed
    // place_id" case from issue #44: a caller must not be able to overwrite
    // an existing link by claiming a different placeId.
    const venue = { place_provider: 'google', provider_place_id: otherPlaceId };
    expect(classifyVenueProviderLink(venue, claimedPlaceId)).toEqual({ kind: 'linked_to_different_place' });
  });

  it('classifies a venue linked under a non-google provider as linked_to_different_place, never as already-linked', () => {
    const venue = { place_provider: 'osm', provider_place_id: claimedPlaceId };
    expect(classifyVenueProviderLink(venue, claimedPlaceId)).toEqual({ kind: 'linked_to_different_place' });
  });
});
