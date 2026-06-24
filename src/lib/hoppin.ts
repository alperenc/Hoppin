import { Beer, BeerStyle, Checkin, CityLocation, CityStamp, CityVisit, CityVisitor, CreateTrailInput, CreateTrailItemInput, Follow, FollowFeedItem, LocationHint, PassportSummary, Profile, CheckinScope, PrivacyLevel, Trail, TrailItem, UpdateTrailInput, Venue } from '@/src/types/hoppin';
import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import { mapResolvedCheckinMediaUrls, resolveCheckinMediaUrlMap, resolveCheckinMediaUrls } from '@/src/lib/media';

type Id = string;

type DbBeer = {
  id: Id;
  name: string;
  style: BeerStyle;
  abv: number | string | null;
  ibu: number | string | null;
  brewery_id: string | null;
  barcode?: string | null;
  created_at: string;
  created_by: string | null;
};

type MockBeer = DbBeer & {
  createdBy: Id;
  createdAt: string;
  breweryName?: string;
};

type DbBeerBarcodeClaim = {
  beer_id: string;
};

type CreateCheckinInput = {
  beerName: string;
  style: BeerStyle;
  breweryName?: string;
  barcode?: string;
  media?: string[];
  scope: CheckinScope;
  privacy: PrivacyLevel;
  note?: string;
  rating?: number;
  venueName?: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  cityLat?: number;
  cityLng?: number;
  venueProvider?: Venue['provider'];
  venueExternalId?: string;
};

type DbProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_creator: boolean;
  created_at: string;
};

type UpdateProfileInput = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

type DbCity = {
  id: string;
  city: string;
  country: string;
  latitude: number | string;
  longitude: number | string;
};

type DbBrewery = {
  id: string;
  name: string;
};

type DbVenue = {
  id: string;
  name: string;
  country: string | null;
  place_provider?: Venue['provider'] | null;
  provider_place_id?: string | null;
  latitude: number | string;
  longitude: number | string;
  city_id: string | null;
  city?: {
    city: string;
    country: string | null;
  } | null;
};

type DbFollowFeedRow = {
  checkin_id: string;
  profile_id: string;
  scope: CheckinScope;
  privacy: PrivacyLevel;
  checked_at: string;
  rating: number | null;
  note: string | null;
  photo_urls: string[] | null;
  beer_id: string;
  beer_name: string;
  beer_style: BeerStyle;
  beer_abv: number | string | null;
  beer_ibu: number | string | null;
  beer_brewery: DbBrewery | null;
  city: string | null;
  country: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  venue_id: string | null;
  venue_name: string | null;
  author_profile: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isCreator: boolean;
    createdAt: string;
  };
  is_followed: boolean;
};

type DbPassportTopStyle = {
  style: BeerStyle;
  count: number | string;
};

type DbProfileCheckinCity = {
  city: string | null;
  country: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

type DbProfileCheckinVenue = {
  id: string;
  name: string;
  country: string | null;
  place_provider?: Venue['provider'] | null;
  provider_place_id?: string | null;
  latitude: number | string;
  longitude: number | string;
  city_id: string | null;
};

type DbProfileCheckinBeer = {
  id: string;
  name: string;
  style: BeerStyle;
  abv: number | string | null;
  ibu: number | string | null;
  brewery_id: string | null;
  barcode?: string | null;
  created_by: string | null;
  created_at: string;
};

type DbProfileCheckinRow = {
  id: string;
  profile_id: string;
  scope: CheckinScope;
  privacy: PrivacyLevel;
  checked_at: string;
  rating: number | string | null;
  note: string | null;
  photo_urls: string[] | null;
  cities?: DbProfileCheckinCity[] | DbProfileCheckinCity | null;
  venues?: DbProfileCheckinVenue[] | DbProfileCheckinVenue | null;
  beers?: DbProfileCheckinBeer[] | DbProfileCheckinBeer | null;
};

type DbSnapshotProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_creator: boolean;
  created_at: string;
};

type DbSnapshotCity = {
  city: string | null;
  country: string | null;
};

type DbSnapshotVenue = {
  city_id: string | null;
  city?: {
    city: string;
    country: string;
  } | { city: string; country: string }[] | null;
};

type DbCitySnapshotRow = {
  profile_id: string;
  checked_at: string;
  scope: CheckinScope;
  cities?: DbSnapshotCity[] | DbSnapshotCity | null;
  venues?: DbSnapshotVenue[] | DbSnapshotVenue | null;
  profiles?: DbSnapshotProfile[] | DbSnapshotProfile | null;
};

type DbCityStamp = {
  city: string | null;
  country: string | null;
  latitude: number | string;
  longitude: number | string;
  checkin_count: number | string;
  last_visited_at: string;
};

type DbTrailProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_creator: boolean;
  created_at: string;
};

type DbTrailRow = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  privacy: PrivacyLevel;
  cover_image: string | null;
  created_at: string;
  updated_at: string;
  profiles?: DbTrailProfile[] | DbTrailProfile | null;
};

type DbTrailItemCity = {
  city: string | null;
  country: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

type DbTrailItemVenue = {
  id: string;
  name: string;
  country: string | null;
  place_provider?: Venue['provider'] | null;
  provider_place_id?: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  city?: {
    city: string | null;
    country: string | null;
  } | { city: string | null; country: string | null }[] | null;
};

type DbTrailItemRow = {
  id: string;
  trail_id: string;
  item_type: 'checkin' | 'place';
  position: number | string;
  checkin_id: string | null;
  venue_id: string | null;
  city_id: string | null;
  title: string | null;
  note: string | null;
  created_at: string;
  cities?: DbTrailItemCity[] | DbTrailItemCity | null;
  venues?: DbTrailItemVenue[] | DbTrailItemVenue | null;
};

const trailSelect = `
  id,
  profile_id,
  title,
  description,
  privacy,
  cover_image,
  created_at,
  updated_at,
  profiles(id,username,display_name,avatar_url,is_creator,created_at)
`;

const trailItemSelect = `
  id,
  trail_id,
  item_type,
  position,
  checkin_id,
  venue_id,
  city_id,
  title,
  note,
  created_at,
  cities(city,country,latitude,longitude),
  venues(id,name,country,place_provider,provider_place_id,latitude,longitude,city:city_id(city,country))
`;

const now = () => new Date().toISOString();

const profilesSeed: Profile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'ale_mixed',
    displayName: 'Alex Pilsner',
    isCreator: true,
    createdAt: '2026-01-08T12:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    username: 'rio_runner',
    displayName: 'Rio',
    isCreator: false,
    createdAt: '2026-02-10T13:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    username: 'ava_travel',
    displayName: 'Ava Hopper',
    isCreator: true,
    createdAt: '2026-03-01T08:20:00Z',
  },
];

const followsSeed: Follow[] = [
  { followerId: profilesSeed[0].id, followingId: profilesSeed[2].id, followedAt: '2026-03-16T09:30:00Z' },
];

const beersSeed: MockBeer[] = [
  {
    id: 'beer_ipa_1',
    name: 'Cloud Lift IPA',
    style: 'ipa',
    abv: 6.8,
    ibu: 60,
    createdBy: profilesSeed[0].id,
    brewery_id: null,
    created_at: '2026-01-12T10:00:00Z',
    created_by: profilesSeed[0].id,
    createdAt: '2026-01-12T10:00:00Z',
    breweryName: 'North Point Brewing',
  },
  {
    id: 'beer_stout_1',
    name: 'Midnight Grain Stout',
    style: 'stout',
    abv: 7.2,
    ibu: 70,
    createdBy: profilesSeed[0].id,
    brewery_id: null,
    created_at: '2026-02-01T11:00:00Z',
    created_by: profilesSeed[0].id,
    createdAt: '2026-02-01T11:00:00Z',
    breweryName: 'Cloud Gate Brewery',
  },
  {
    id: 'beer_triple_1',
    name: 'Bridges Triple',
    style: 'other',
    abv: 8.4,
    ibu: 28,
    createdBy: profilesSeed[1].id,
    brewery_id: null,
    created_at: '2026-03-17T12:00:00Z',
    created_by: profilesSeed[1].id,
    createdAt: '2026-03-17T12:00:00Z',
    breweryName: 'Bridges & Co.',
  },
];

const citiesSeed: CityLocation[] = [
  { city: 'Chicago', country: 'USA', lat: 41.8781, lng: -87.6298 },
  { city: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
];

const venuesSeed: Venue[] = [
  {
    id: 'venue_chi_1',
    name: 'Magnolia Public House',
    city: 'Chicago',
    country: 'USA',
    provider: 'google',
    lat: 41.8781,
    lng: -87.6298,
  },
  {
    id: 'venue_berlin_1',
    name: 'Kreuzberg Taproom',
    city: 'Berlin',
    country: 'Germany',
    provider: 'google',
    lat: 52.495,
    lng: 13.377,
  },
];

let profiles = [...profilesSeed];
let follows = [...followsSeed];
let beers = [...beersSeed];
let cities = [...citiesSeed];
let venues = [...venuesSeed];

let checkins: Checkin[] = [
  {
    id: 'checkin_1',
    profileId: profilesSeed[1].id,
    beer: normalizeBeer(beersSeed[0]),
    scope: 'venue',
    venue: venues[0],
    checkedAt: '2026-05-10T20:12:00Z',
    privacy: 'followers',
    rating: 4,
    note: 'Dry citrus nose, crisp finish.',
    media: [],
  },
  {
    id: 'checkin_2',
    profileId: profilesSeed[0].id,
    beer: normalizeBeer(beersSeed[1]),
    scope: 'city',
    city: cities[1],
    checkedAt: '2026-05-11T21:02:00Z',
    privacy: 'public',
    rating: 5,
    note: 'Late-night trip memory.',
    media: [],
  },
];

let trails: Trail[] = [
  {
    id: 'trail_1',
    profileId: profilesSeed[0].id,
    title: 'Berlin dark beers',
    description: 'A short saved route from passport stamps.',
    privacy: 'public',
    coverImage: undefined,
    createdAt: '2026-05-11T22:00:00Z',
    updatedAt: '2026-05-11T22:00:00Z',
    owner: profilesSeed[0],
    author: profilesSeed[0],
    items: [
      {
        id: 'trail_item_1',
        trailId: 'trail_1',
        kind: 'checkin',
        position: 0,
        checkinId: 'checkin_2',
        checkin: checkins[1],
        createdAt: '2026-05-11T22:00:00Z',
      },
    ],
    itemCount: 1,
  },
];

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const useSupabase = () => isSupabaseConfigured;

export const CURRENT_USER_ID = profilesSeed[0].id;

function sanitizeUsername(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const fallback = raw.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'hoppin';

  return normalized.slice(0, 36) || `user_${fallback}`;
}

function normalizeEditableUsername(raw: string): string {
  const username = sanitizeUsername(raw);
  if (username.length >= 3) {
    return username;
  }

  return `${username}_hop`.slice(0, 36);
}

function buildProfileFromAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    avatar_url?: string | null;
  };
}) {
  const localPart = user.email?.split('@')[0]?.toLowerCase() ?? user.id.split('-')[0];
  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? localPart ?? 'Hoppin User';

  return {
    username: sanitizeUsername(`${localPart}_${user.id.slice(0, 8)}`),
    displayName,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
  };
}

async function getAuthenticatedSessionUser() {
  if (!useSupabase()) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return null;
  }

  return data.session?.user ?? null;
}

async function canUseSupabaseBackend(): Promise<boolean> {
  const sessionUser = await getAuthenticatedSessionUser();
  return Boolean(sessionUser);
}

async function resolveProfileId(profileId?: Id): Promise<Id> {
  if (profileId) {
    return profileId;
  }

  const sessionUser = await getAuthenticatedSessionUser();
  return sessionUser?.id ?? CURRENT_USER_ID;
}

export const checkinVisibilityLabel = (privacy: PrivacyLevel): string => {
  if (privacy === 'followers') return 'Followers';
  if (privacy === 'public') return 'Public';
  return 'Private';
};

export function cityStampKey(city: CityLocation): string {
  return `${city.city.toLowerCase()}-${city.country.toLowerCase()}`;
}

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function toInt(value: number | string | null | undefined): number | undefined {
  const num = toNumber(value);
  return num === undefined ? undefined : Math.round(num);
}

function normalizeText(value: string): string {
  return value.trim();
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function normalizeBarcode(value?: string): string | undefined {
  const normalized = value?.replace(/[^0-9A-Za-z]/g, '').trim();
  if (!normalized) return undefined;

  if (/^0\d{12}$/.test(normalized)) {
    return normalized.slice(1);
  }

  return normalized;
}

function normalizeBeer(beer: MockBeer) {
  return {
    id: beer.id,
    name: beer.name,
    style: beer.style,
    abv: toNumber(beer.abv),
    ibu: toInt(beer.ibu),
    brewery: beer.breweryName
      ? {
          id: `brew_${beer.breweryName.toLowerCase().replaceAll(' ', '_')}`,
          name: beer.breweryName,
        }
      : undefined,
    createdBy: beer.createdBy,
    createdAt: beer.createdAt,
    barcode: beer.barcode ?? undefined,
  };
}

function normalizeRating(rawRating?: number): number | undefined {
  if (typeof rawRating !== 'number' || Number.isNaN(rawRating)) return undefined;
  const rounded = Math.round(rawRating);
  if (rounded < 1 || rounded > 5) return undefined;
  return rounded;
}

function toProfile(row: DbProfile): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    isCreator: row.is_creator,
    createdAt: row.created_at,
  };
}

function firstOrSingle<T>(value?: T | T[] | null): T | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value ?? undefined;
}

function toTrailProfile(row?: DbTrailProfile[] | DbTrailProfile | null): Profile | undefined {
  const profile = firstOrSingle(row);
  return profile ? toProfile(profile) : undefined;
}

function cloneTrail(trail: Trail): Trail {
  const author = profiles.find((profile) => profile.id === trail.profileId) ?? trail.author;
  const items = trail.items
    .map((item) => ({
      ...item,
      checkin: item.checkinId ? checkins.find((checkin) => checkin.id === item.checkinId) : item.checkin,
    }))
    .sort((a, b) => a.position - b.position);

  return {
    ...trail,
    owner: author,
    author,
    items,
    itemCount: items.length,
  };
}

function canViewTrail(trail: Trail, viewerId?: Id): boolean {
  if (trail.profileId === viewerId) return true;
  if (trail.privacy === 'public') return true;
  if (trail.privacy === 'followers' && viewerId) {
    return follows.some((follow) => follow.followerId === viewerId && follow.followingId === trail.profileId);
  }

  return false;
}

function mapDbTrail(row: DbTrailRow, items: TrailItem[] = []): Trail {
  const sortedItems = [...items].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    profileId: row.profile_id,
    title: row.title,
    description: row.description ?? undefined,
    privacy: row.privacy,
    coverImage: row.cover_image ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: toTrailProfile(row.profiles),
    author: toTrailProfile(row.profiles),
    items: sortedItems,
    itemCount: sortedItems.length,
  };
}

function mapDbTrailItem(row: DbTrailItemRow, checkinsById: Map<string, Checkin>): TrailItem {
  const cityRow = firstOrSingle(row.cities);
  const venueRow = firstOrSingle(row.venues);
  const venueCity = firstOrSingle(venueRow?.city);
  const city = cityRow?.city
    ? {
        city: cityRow.city,
        country: cityRow.country ?? 'Unknown',
        lat: toNumber(cityRow.latitude) ?? 0,
        lng: toNumber(cityRow.longitude) ?? 0,
      }
    : undefined;
  const venue = venueRow
    ? {
        id: venueRow.id,
        name: venueRow.name,
        city: venueCity?.city ?? city?.city ?? 'Unknown',
        country: venueRow.country ?? venueCity?.country ?? city?.country ?? 'Unknown',
        provider: venueRow.place_provider ?? 'user',
        externalId: venueRow.provider_place_id ?? undefined,
        lat: toNumber(venueRow.latitude) ?? city?.lat ?? 0,
        lng: toNumber(venueRow.longitude) ?? city?.lng ?? 0,
      }
    : undefined;

  return {
    id: row.id,
    trailId: row.trail_id,
    kind: row.item_type,
    position: toInt(row.position) ?? 0,
    checkinId: row.checkin_id ?? undefined,
    checkin: row.checkin_id ? checkinsById.get(row.checkin_id) : undefined,
    venue,
    city,
    title: row.title ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function mapDbFollowFeed(row: DbFollowFeedRow, media: string[] = row.photo_urls ?? []): FollowFeedItem {
  const author = {
    id: row.author_profile.id,
    username: row.author_profile.username,
    displayName: row.author_profile.displayName,
    avatarUrl: row.author_profile.avatarUrl ?? undefined,
    isCreator: row.author_profile.isCreator,
    createdAt: row.author_profile.createdAt,
  };
  const city = row.scope === 'city' ? row.city : null;
  const country = row.scope === 'city' ? row.country : row.country;
  const latitude = toNumber(row.latitude) ?? 0;
  const longitude = toNumber(row.longitude) ?? 0;
  const location = city || country || latitude || longitude
    ? ({
        city: city ?? 'Unknown',
        country: country ?? 'Unknown',
        lat: latitude,
        lng: longitude,
      } as CityLocation)
    : undefined;
  return {
    checkin: {
      id: row.checkin_id,
      profileId: row.profile_id,
      beer: {
        id: row.beer_id,
        name: row.beer_name,
        style: row.beer_style,
        abv: toNumber(row.beer_abv),
        ibu: toInt(row.beer_ibu),
        brewery: row.beer_brewery ? { id: row.beer_brewery.id, name: row.beer_brewery.name } : undefined,
        createdBy: row.profile_id,
        createdAt: row.checked_at,
      },
      scope: row.scope,
      city: row.scope === 'city' ? location : undefined,
      venue:
        row.scope === 'venue'
          ? {
              id: row.venue_id ?? `venue_${row.checkin_id}`,
              name: row.venue_name ?? 'Unknown venue',
              city: location?.city ?? 'Unknown',
              country: location?.country ?? 'Unknown',
              provider: 'user',
              lat: location?.lat ?? 0,
              lng: location?.lng ?? 0,
            }
          : undefined,
      checkedAt: row.checked_at,
      privacy: row.privacy,
      rating: normalizeRating(row.rating ?? undefined),
      note: row.note ?? undefined,
      media,
    },
    author,
    followed: Boolean(row.is_followed),
  };
}

function mapDbProfileCheckin(
  row: DbProfileCheckinRow,
  venueCityById: Map<string, DbCity>,
  breweriesById: Map<string, DbBrewery>,
  media: string[] = row.photo_urls ?? [],
): Checkin {
  const cities = Array.isArray(row.cities) ? row.cities[0] : row.cities;
  const venues = Array.isArray(row.venues) ? row.venues[0] : row.venues;
  const beers = Array.isArray(row.beers) ? row.beers[0] : row.beers;
  const scopeCity = cities && row.scope === 'city' ? cities : null;
  const venueCity = venues?.city_id ? venueCityById.get(venues.city_id) : null;
  const brewery = beers?.brewery_id ? breweriesById.get(beers.brewery_id) : null;

  return {
    id: row.id,
    profileId: row.profile_id,
    beer: {
      id: beers?.id ?? '',
      name: beers?.name ?? 'Unknown beer',
      style: beers?.style ?? 'other',
      abv: toNumber(beers?.abv ?? null),
      ibu: toInt(beers?.ibu ?? null),
      brewery: brewery ? { id: brewery.id, name: brewery.name } : undefined,
      createdBy: beers?.created_by ?? '',
      createdAt: beers?.created_at ?? now(),
      barcode: beers?.barcode ?? undefined,
    },
    scope: row.scope,
    city:
      row.scope === 'city'
        ? {
            city: scopeCity?.city ?? 'Unknown',
            country: scopeCity?.country ?? 'Unknown',
            lat: toNumber(scopeCity?.latitude) ?? 0,
            lng: toNumber(scopeCity?.longitude) ?? 0,
          }
        : undefined,
    venue:
      row.scope === 'venue' && row.venues
        ? {
            id: venues?.id ?? '',
            name: venues?.name ?? 'Unknown venue',
            city: venueCity?.city ?? 'Unknown',
            country: venues?.country ?? venueCity?.country ?? 'Unknown',
            provider: venues?.place_provider ?? 'user',
            externalId: venues?.provider_place_id ?? undefined,
            lat: toNumber(venues?.latitude) ?? 0,
            lng: toNumber(venues?.longitude) ?? 0,
          }
        : undefined,
    checkedAt: row.checked_at,
    privacy: row.privacy,
    rating: normalizeRating(toNumber(row.rating)),
    note: row.note ?? undefined,
    media,
  };
}

function snapshotCityFromRaw(scope: CheckinScope, cities?: DbSnapshotCity[] | DbSnapshotCity | null, venues?: DbSnapshotVenue[] | DbSnapshotVenue | null): CityLocation | null {
  const cityRow = Array.isArray(cities) ? cities[0] : cities;
  const venueRow = Array.isArray(venues) ? venues[0] : venues;
  const venueCity =
    venueRow?.city && !Array.isArray(venueRow.city)
      ? venueRow.city
      : Array.isArray(venueRow?.city)
        ? venueRow.city[0]
        : null;

  if (scope === 'city' && cityRow?.city && cityRow?.country) {
    return {
      city: cityRow.city,
      country: cityRow.country,
      lat: 0,
      lng: 0,
    };
  }

  if (scope === 'venue' && venueCity?.city && venueCity?.country) {
    return {
      city: venueCity.city,
      country: venueCity.country,
      lat: 0,
      lng: 0,
    };
  }

  return null;
}

function normalizeCityMatch(city: string, country: string): { city: string; country: string } {
  return {
    city: city.trim(),
    country: country.trim(),
  };
}

function citySnapshotProfile(row: DbCitySnapshotRow): Profile | null {
  const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  if (!profileRow) return null;
  return toProfile(profileRow);
}

type FeedScoringContext = {
  followedProfileIds: Set<string>;
  preferredCountries: Set<string>;
  preferredStyles: Set<BeerStyle>;
};

function scoreFeedItem(item: FollowFeedItem, context: FeedScoringContext): number {
  let score = 0;
  if (context.followedProfileIds.has(item.checkin.profileId) || item.followed) {
    score += 1000;
  }

  const tripCountry = item.checkin.city?.country ?? item.checkin.venue?.country;
  if (tripCountry && context.preferredCountries.has(tripCountry.toLowerCase().trim())) {
    score += 30;
  }

  if (context.preferredStyles.has(item.checkin.beer.style)) {
    score += 12;
  }

  return score;
}

function topStylesFromSummary(summary: PassportSummary, limit = 3): Set<BeerStyle> {
  return new Set(summary.topStyles.slice(0, limit).map((entry) => entry.style));
}

function mapDbPassportSummary(row?: { checkins_count: number | string | null; cities_count: number | string | null; countries_count: number | string | null; unique_beers_count: number | string | null; unique_breweries_count: number | string | null } | null): PassportSummary {
  return {
    checkinsCount: toInt(row?.checkins_count) ?? 0,
    citiesCount: toInt(row?.cities_count) ?? 0,
    countriesCount: toInt(row?.countries_count) ?? 0,
    uniqueBeersCount: toInt(row?.unique_beers_count) ?? 0,
    uniqueBreweriesCount: toInt(row?.unique_breweries_count) ?? 0,
    topStyles: [],
  };
}

async function fallbackProfileFromSeed(profileId: Id): Promise<Profile | null> {
  return profiles.find((profile) => profile.id === profileId) ?? null;
}

async function getProfileFromSupabase(profileId: Id): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,is_creator,created_at')
    .eq('id', profileId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(error.message);
  }

  if (!data) return null;
  return toProfile(data);
}

async function getProfilesFromSupabase(ids?: Id[]): Promise<Profile[]> {
  let query = supabase.from('profiles').select('id,username,display_name,avatar_url,is_creator,created_at');

  if (ids && ids.length > 0) {
    const { data, error } = await query.in('id', ids).order('display_name');
    if (error) throw new Error(error.message);
    return (data ?? []).map(toProfile);
  }

  const { data, error } = await query.order('display_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(toProfile);
}

async function getCurrentProfileOrSeed(profileId?: Id): Promise<Profile> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (await canUseSupabaseBackend()) {
    const profile = await getProfileFromSupabase(resolvedProfileId);
    if (profile) {
      return profile;
    }

    const sessionUser = await getAuthenticatedSessionUser();
    if (sessionUser && sessionUser.id === resolvedProfileId) {
      const built = buildProfileFromAuthUser(sessionUser);

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: sessionUser.id,
            username: built.username,
            display_name: built.displayName,
            avatar_url: built.avatarUrl,
            is_creator: false,
          },
          { onConflict: 'id' }
        )
        .select('id,username,display_name,avatar_url,is_creator,created_at')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return toProfile(data);
    }
  }

  const fallbackProfile = await fallbackProfileFromSeed(resolvedProfileId);
  if (fallbackProfile) {
    return fallbackProfile;
  }

  if (!uuidRegex.test(resolvedProfileId)) {
    throw new Error('Current profile id is not a valid UUID for Supabase mode.');
  }

  throw new Error('Current profile not found.');
}

export async function setProfileCreatorRole(profileId: Id, isCreator: boolean): Promise<Profile> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    const existing = profiles.find((profile) => profile.id === resolvedProfileId);
    if (!existing) {
      throw new Error('Profile not found.');
    }
    profiles = profiles.map((profile) =>
      profile.id === resolvedProfileId
        ? {
            ...profile,
            isCreator,
          }
        : profile
    );
    return {
      ...existing,
      isCreator,
    };
  }

  if (!uuidRegex.test(resolvedProfileId)) {
    throw new Error('Profile id is not a valid UUID.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_creator: isCreator })
    .eq('id', resolvedProfileId)
    .select('id,username,display_name,avatar_url,is_creator,created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toProfile(data);
}

export async function updateProfileIdentity(profileId: Id, input: UpdateProfileInput): Promise<Profile> {
  const resolvedProfileId = await resolveProfileId(profileId);
  const displayName = input.displayName.trim();
  const username = normalizeEditableUsername(input.username);
  const avatarUrl = input.avatarUrl === undefined ? undefined : (input.avatarUrl ?? '').trim() || null;

  if (!displayName) {
    throw new Error('Display name is required.');
  }

  if (!(await canUseSupabaseBackend())) {
    const existing = profiles.find((profile) => profile.id === resolvedProfileId);
    if (!existing) {
      throw new Error('Profile not found.');
    }

    const usernameTaken = profiles.some(
      (profile) => profile.id !== resolvedProfileId && profile.username.toLowerCase() === username
    );
    if (usernameTaken) {
      throw new Error('That handle is already taken.');
    }

    const nextProfile = {
      ...existing,
      displayName,
      username,
      ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl ?? undefined } : {}),
    };
    profiles = profiles.map((profile) => (profile.id === resolvedProfileId ? nextProfile : profile));
    return nextProfile;
  }

  if (!uuidRegex.test(resolvedProfileId)) {
    throw new Error('Profile id is not a valid UUID.');
  }

  const payload: { display_name: string; username: string; avatar_url?: string | null } = {
    display_name: displayName,
    username,
  };

  if (avatarUrl !== undefined) {
    payload.avatar_url = avatarUrl;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', resolvedProfileId)
    .select('id,username,display_name,avatar_url,is_creator,created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('That handle is already taken.');
    }
    throw new Error(error.message);
  }

  return toProfile(data);
}

async function findOrCreateCity(city: string, country: string, lat?: number, lng?: number): Promise<DbCity> {
  if (!useSupabase()) {
    const existing = cities.find((entry) => entry.city.toLowerCase() === city.toLowerCase() && entry.country.toLowerCase() === country.toLowerCase());
    if (existing) {
      return {
        id: `seed_${existing.city}`,
        city: existing.city,
        country: existing.country,
        latitude: existing.lat,
        longitude: existing.lng,
      };
    }
    if (lat === undefined || lng === undefined) {
      throw new Error('City coordinates are required for new cities.');
    }
    const next: CityLocation = { city, country, lat, lng };
    cities = [...cities, next];
    return {
      id: `city_${cities.length}`,
      city,
      country,
      latitude: lat,
      longitude: lng,
    };
  }

  const { data, error } = await supabase
    .from('cities')
    .select('id,city,country,latitude,longitude')
    .ilike('city', city)
    .ilike('country', country)
    .limit(1);
  if (error) {
    throw new Error(error.message);
  }

  if (data?.[0]) {
    return data[0] as DbCity;
  }

  if (lat === undefined || lng === undefined) {
    throw new Error('City coordinates are required for new cities.');
  }

  const { data: inserted, error: insertError } = await supabase
    .from('cities')
    .insert({ city, country, latitude: lat, longitude: lng })
    .select('id,city,country,latitude,longitude')
    .single();
  if (insertError) throw new Error(insertError.message);
  return inserted as DbCity;
}

async function findOrCreateBrewery(name: string | undefined): Promise<string | null> {
  if (!name) return null;
  const breweryName = normalizeText(name);
  if (!breweryName) return null;

  if (!useSupabase()) {
    const existing = beers.find((beer) => beer.breweryName?.toLowerCase() === breweryName.toLowerCase());
    if (existing?.breweryName) {
      return `brew_${existing.breweryName.toLowerCase().replaceAll(' ', '_')}`;
    }
    return `brew_${breweryName.toLowerCase().replaceAll(' ', '_')}`;
  }

  const { data, error } = await supabase
    .from('breweries')
    .select('id,name')
    .ilike('name', breweryName)
    .limit(1);
  if (error) throw new Error(error.message);

  if (data?.[0]) {
    return data[0].id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('breweries')
    .insert({ name: breweryName })
    .select('id')
    .single();
  if (insertError) throw new Error(insertError.message);

  return inserted.id;
}

export async function lookupBeerByBarcode(rawBarcode: string): Promise<Beer | null> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return null;

  if (!useSupabase()) {
    const beer = beers.find((candidate) => normalizeBarcode(candidate.barcode ?? undefined) === barcode);
    return beer ? normalizeBeer(beer) : null;
  }

  const claimedBeerId = await findClaimedBeerIdByBarcode(barcode);
  if (claimedBeerId) {
    const { data: claimedRows, error: claimedError } = await supabase
      .from('beers')
      .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by,breweries(id,name)')
      .eq('id', claimedBeerId)
      .limit(1);
    if (claimedError) throw new Error(claimedError.message);

    const claimedRow = (claimedRows?.[0] as (DbBeer & { breweries?: DbBrewery[] | DbBrewery | null }) | undefined);
    if (claimedRow) {
      return mapBeerLookupRow(claimedRow, barcode);
    }
  }

  const { data, error } = await supabase
    .from('beers')
    .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by,breweries(id,name)')
    .eq('barcode', barcode)
    .limit(1);
  if (error) throw new Error(error.message);

  const row = (data?.[0] as (DbBeer & { breweries?: DbBrewery[] | DbBrewery | null }) | undefined);
  if (!row) return null;

  return mapBeerLookupRow(row, barcode);
}

export async function lookupBeerByName(rawName: string): Promise<Beer | null> {
  const name = normalizeText(rawName);
  if (name.length < 3) return null;

  if (!useSupabase()) {
    const beer = beers.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
    return beer ? normalizeBeer(beer) : null;
  }

  const { data, error } = await supabase
    .from('beers')
    .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by,breweries(id,name)')
    .ilike('name', escapeIlikePattern(name))
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);

  const row = (data as (DbBeer & { breweries?: DbBrewery[] | DbBrewery | null })[] | null | undefined)
    ?.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
  return row ? mapBeerLookupRow(row) : null;
}

function mapBeerLookupRow(row: DbBeer & { breweries?: DbBrewery[] | DbBrewery | null }, fallbackBarcode?: string): Beer {
  const brewery = Array.isArray(row.breweries) ? row.breweries[0] : row.breweries;

  return {
    id: row.id,
    name: row.name,
    style: row.style,
    abv: toNumber(row.abv),
    ibu: toInt(row.ibu),
    brewery: brewery ? { id: brewery.id, name: brewery.name } : undefined,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    barcode: row.barcode ?? fallbackBarcode,
  };
}

async function findClaimedBeerIdByBarcode(barcode: string): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('beer_barcode_claims')
    .select('beer_id')
    .eq('barcode', barcode)
    .limit(1);
  if (error) throw new Error(error.message);

  return (data?.[0] as DbBeerBarcodeClaim | undefined)?.beer_id;
}

async function findDbBeerById(beerId: string): Promise<DbBeer | undefined> {
  const { data, error } = await supabase
    .from('beers')
    .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by')
    .eq('id', beerId)
    .limit(1);
  if (error) throw new Error(error.message);

  return data?.[0] as DbBeer | undefined;
}

async function findDbBeerByBarcodeClaim(barcode: string): Promise<DbBeer | undefined> {
  const claimedBeerId = await findClaimedBeerIdByBarcode(barcode);
  return claimedBeerId ? findDbBeerById(claimedBeerId) : undefined;
}

async function claimBeerBarcode(beerId: string, profileId: string, barcode: string): Promise<DbBeer | undefined> {
  const { error } = await supabase.from('beer_barcode_claims').insert({
    beer_id: beerId,
    profile_id: profileId,
    barcode,
  });

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }

  return findDbBeerByBarcodeClaim(barcode);
}

async function findOrCreateBeer(name: string, style: BeerStyle, authorId: Id, breweryName?: string, rawBarcode?: string): Promise<DbBeer> {
  const normalizedBeer = normalizeText(name);
  const barcode = normalizeBarcode(rawBarcode);
  if (!normalizedBeer) {
    throw new Error('Beer name is required.');
  }

  if (!useSupabase()) {
    const existing = beers.find(
      (b) =>
        (barcode && normalizeBarcode(b.barcode ?? undefined) === barcode) ||
        (b.name.toLowerCase() === normalizedBeer.toLowerCase() && b.style === style)
    );
    if (existing) {
      if (barcode && !existing.barcode) {
        const updated = { ...existing, barcode };
        beers = beers.map((beer) => (beer.id === existing.id ? updated : beer));
        return updated;
      }

      return existing;
    }

    const next: MockBeer = {
      id: `beer_${beers.length + 1}`,
      name: normalizedBeer,
      style,
      createdBy: authorId,
      created_at: now(),
      created_by: authorId,
      abv: null,
      ibu: null,
      brewery_id: null,
      barcode: barcode ?? null,
      createdAt: now(),
      breweryName,
    };
    beers = [...beers, next];
    return next;
  }

  if (barcode) {
    const claimedBeer = await findDbBeerByBarcodeClaim(barcode);
    if (claimedBeer) {
      return claimedBeer;
    }

    const { data: barcodeRows, error: barcodeError } = await supabase
      .from('beers')
      .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by')
      .eq('barcode', barcode)
      .limit(1);
    if (barcodeError) throw new Error(barcodeError.message);

    if (barcodeRows?.[0]) {
      return barcodeRows[0] as DbBeer;
    }
  }

  const { data, error } = await supabase
    .from('beers')
    .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by')
    .ilike('name', normalizedBeer)
    .eq('style', style)
    .limit(1);
  if (error) throw new Error(error.message);

  if (data?.[0]) {
    if (barcode && data[0].barcode !== barcode) {
      if (data[0].barcode !== null) {
        const claimedBeer = await claimBeerBarcode(data[0].id, authorId, barcode);
        if (claimedBeer) {
          return claimedBeer;
        }

        return data[0] as DbBeer;
      }

      if (data[0].created_by !== authorId) {
        const claimedBeer = await claimBeerBarcode(data[0].id, authorId, barcode);
        if (claimedBeer) {
          return claimedBeer;
        }

        return data[0] as DbBeer;
      }

      const { data: updated, error: updateError } = await supabase
        .from('beers')
        .update({ barcode })
        .eq('id', data[0].id)
        .is('barcode', null)
        .eq('created_by', authorId)
        .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by')
        .single();

      if (!updateError && updated) {
        return updated as DbBeer;
      }

      const { data: retryRows, error: retryError } = await supabase
        .from('beers')
        .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by')
        .eq('barcode', barcode)
        .limit(1);
      if (!retryError && retryRows?.[0]) {
        return retryRows[0] as DbBeer;
      }

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    return data[0] as DbBeer;
  }

  const breweryId = await findOrCreateBrewery(breweryName);
  const { data: inserted, error: insertError } = await supabase
    .from('beers')
    .insert({
      name: normalizedBeer,
      style,
      created_by: authorId,
      brewery_id: breweryId,
      barcode: barcode ?? null,
    })
    .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by')
    .single();
  if (insertError) {
    if (barcode) {
      const { data: retryRows, error: retryError } = await supabase
        .from('beers')
        .select('id,name,style,abv,ibu,brewery_id,barcode,created_at,created_by')
        .eq('barcode', barcode)
        .limit(1);
      if (!retryError && retryRows?.[0]) {
        return retryRows[0] as DbBeer;
      }
    }

    throw new Error(insertError.message);
  }
  return inserted as DbBeer;
}

async function findOrCreateVenue(
  name: string,
  locationCity: DbCity,
  lat: number,
  lng: number,
  provider: Venue['provider'] = 'user',
  externalId?: string
): Promise<DbVenue> {
  const normalizedName = normalizeText(name);
  if (!useSupabase()) {
    const existing = venues.find(
      (v) =>
        (externalId && v.provider === provider && v.externalId === externalId) ||
        (v.name.toLowerCase() === normalizedName.toLowerCase() && v.city.toLowerCase() === locationCity.city.toLowerCase())
    );
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        country: existing.country,
        place_provider: existing.provider,
        provider_place_id: existing.externalId,
        latitude: existing.lat,
        longitude: existing.lng,
        city_id: `seed_${locationCity.city}`,
        city: {
          city: existing.city,
          country: existing.country,
        },
      };
    }
    const next: Venue = {
      id: `venue_${venues.length + 1}`,
      name: normalizedName,
      city: locationCity.city,
      country: locationCity.country,
      provider,
      externalId,
      lat,
      lng,
    };
    venues = [...venues, next];
    return {
      id: next.id,
      name: next.name,
      country: next.country,
      place_provider: next.provider,
      provider_place_id: next.externalId,
      latitude: next.lat,
      longitude: next.lng,
      city_id: `seed_${locationCity.city}`,
    };
  }

  if (externalId) {
    const { data: providerRows, error: providerError } = await supabase
      .from('venues')
      .select('id,name,country,place_provider,provider_place_id,latitude,longitude,city_id')
      .eq('place_provider', provider)
      .eq('provider_place_id', externalId)
      .limit(1);
    if (providerError) throw new Error(providerError.message);

    if (providerRows?.[0]) {
      return providerRows[0] as DbVenue;
    }
  }

  const { data, error } = await supabase
    .from('venues')
    .select('id,name,country,place_provider,provider_place_id,latitude,longitude,city_id')
    .eq('city_id', locationCity.id)
    .ilike('name', normalizedName)
    .limit(1);
  if (error) throw new Error(error.message);

  if (data?.[0]) {
    return data[0] as DbVenue;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('venues')
    .insert({
      name: normalizedName,
      city_id: locationCity.id,
      country: locationCity.country,
      place_provider: provider,
      provider_place_id: externalId ?? null,
      latitude: lat,
      longitude: lng,
    })
    .select('id,name,country,place_provider,provider_place_id,latitude,longitude,city_id')
    .single();
  if (insertError) {
    if (externalId) {
      const { data: retryRows, error: retryError } = await supabase
        .from('venues')
        .select('id,name,country,place_provider,provider_place_id,latitude,longitude,city_id')
        .eq('place_provider', provider)
        .eq('provider_place_id', externalId)
        .limit(1);
      if (!retryError && retryRows?.[0]) {
        return retryRows[0] as DbVenue;
      }
    }

    throw new Error(insertError.message);
  }
  return inserted as DbVenue;
}

export async function getCurrentProfile() {
  return getCurrentProfileOrSeed();
}

export async function getProfileByUsernameOrId(slug: string): Promise<Profile | null> {
  const normalized = slug.trim().toLowerCase().replace(/^@/, '');
  if (!normalized) {
    return null;
  }

  if (!useSupabase()) {
    return profiles.find((profile) => profile.username.toLowerCase() === normalized) ?? null;
  }

  const query = uuidRegex.test(normalized)
    ? supabase.from('profiles').select('id,username,display_name,avatar_url,is_creator,created_at').eq('id', normalized)
    : supabase.from('profiles').select('id,username,display_name,avatar_url,is_creator,created_at').eq('username', normalized);

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return toProfile(data);
}

export async function listProfiles() {
  if (!(await canUseSupabaseBackend())) {
    return [...profiles].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return getProfilesFromSupabase();
}

export async function getFollowedProfiles(profileId?: Id): Promise<Profile[]> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    const followed = follows.filter((f) => f.followerId === resolvedProfileId).map((f) => f.followingId);
    return profiles.filter((p) => followed.includes(p.id));
  }

  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', resolvedProfileId)
    .order('followed_at');
  if (error) throw new Error(error.message);
  const followedIds = (data ?? []).map((row: { following_id: string }) => row.following_id);
  if (!followedIds.length) return [];
  return getProfilesFromSupabase(followedIds);
}

export async function getFollowers(profileId?: Id): Promise<Profile[]> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    const followerIds = follows.filter((f) => f.followingId === resolvedProfileId).map((f) => f.followerId);
    return profiles.filter((p) => followerIds.includes(p.id));
  }

  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', resolvedProfileId)
    .order('followed_at');
  if (error) throw new Error(error.message);
  const followerIds = (data ?? []).map((row: { follower_id: string }) => row.follower_id);
  if (!followerIds.length) return [];
  return getProfilesFromSupabase(followerIds);
}

export async function listCityTrips(profileId?: Id): Promise<CityVisit[]> {
  const resolvedProfileId = await resolveProfileId(profileId);

  const visits = new Map<string, CityVisit>();

  if (!(await canUseSupabaseBackend())) {
    const personalCheckins = checkins
      .filter((checkin) => checkin.profileId === resolvedProfileId)
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));

    for (const checkin of personalCheckins) {
      const city = checkin.city ?? {
        city: checkin.venue?.city ?? 'Unknown',
        country: checkin.venue?.country ?? 'Unknown',
        lat: 0,
        lng: 0,
      };
      if (!city.city || !city.country) continue;

      const key = cityStampKey(city);
      const existing = visits.get(key);
      if (!existing) {
        visits.set(key, {
          city: city.city,
          country: city.country,
          firstVisitedAt: checkin.checkedAt,
          lastVisitedAt: checkin.checkedAt,
          checkinCount: 1,
        });
        continue;
      }

      existing.checkinCount += 1;
      if (checkin.checkedAt > existing.lastVisitedAt) {
        existing.lastVisitedAt = checkin.checkedAt;
      }
      if (checkin.checkedAt < existing.firstVisitedAt) {
        existing.firstVisitedAt = checkin.checkedAt;
      }
    }

    return [...visits.values()].sort((a, b) => b.lastVisitedAt.localeCompare(a.lastVisitedAt));
  }

  const { data, error } = await supabase
    .from('checkins')
    .select(
      `
      scope,
      checked_at,
      cities(city,country),
      venues(city_id,city:city_id(city,country))
    `
    )
    .eq('profile_id', resolvedProfileId)
    .order('checked_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as DbCitySnapshotRow[]) {
    const city = snapshotCityFromRaw(row.scope, row.cities, row.venues);
    if (!city?.city || !city.country) {
      continue;
    }

    const key = cityStampKey(city);
    const existing = visits.get(key);
    const timestamp = row.checked_at;
    if (!existing) {
      visits.set(key, {
        city: city.city,
        country: city.country,
        firstVisitedAt: timestamp,
        lastVisitedAt: timestamp,
        checkinCount: 1,
      });
      continue;
    }

    existing.checkinCount += 1;
    if (timestamp > existing.lastVisitedAt) {
      existing.lastVisitedAt = timestamp;
    }
    if (timestamp < existing.firstVisitedAt) {
      existing.firstVisitedAt = timestamp;
    }
  }

  return [...visits.values()].sort((a, b) => b.lastVisitedAt.localeCompare(a.lastVisitedAt));
}

export async function listPublicCityVisitors(city: string, country: string, excludeProfileId?: Id): Promise<CityVisitor[]> {
  const normalizedCity = normalizeCityMatch(city, country);
  if (!normalizedCity.city || !normalizedCity.country) return [];
  const resolvedExcludeId = excludeProfileId ? await resolveProfileId(excludeProfileId) : undefined;

  if (!(await canUseSupabaseBackend())) {
    const visitors = new Map<string, CityVisitor>();
    for (const checkin of checkins) {
      if (checkin.privacy !== 'public') continue;
      if (checkin.profileId === resolvedExcludeId) continue;

      const checkinCity = checkin.city ?? {
        city: checkin.venue?.city ?? '',
        country: checkin.venue?.country ?? '',
      };

      if (checkinCity.city === normalizedCity.city && checkinCity.country === normalizedCity.country) {
        const profile = profiles.find((item) => item.id === checkin.profileId);
        if (!profile) continue;
        if (!visitors.has(profile.id)) {
          visitors.set(profile.id, {
            profileId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
          });
        }
      }
    }
    return [...visitors.values()];
  }

  const { data, error } = await supabase
    .from('checkins')
    .select(
      `
      profile_id,
      checked_at,
      scope,
      cities(city,country),
      venues(city_id,city:city_id(city,country)),
      profiles(id,username,display_name,avatar_url,is_creator,created_at)
      `
    )
    .eq('privacy', 'public')
    .order('checked_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as DbCitySnapshotRow[];
  const visitorRows = new Map<string, Profile>();

  for (const row of rows) {
    if (resolvedExcludeId && row.profile_id === resolvedExcludeId) continue;
    const location = snapshotCityFromRaw(row.scope, row.cities, row.venues);
    if (!location || location.city !== normalizedCity.city || location.country !== normalizedCity.country) {
      continue;
    }

    const profile = citySnapshotProfile(row);
    if (!profile) continue;
    if (!visitorRows.has(profile.id)) {
      visitorRows.set(profile.id, profile);
    }
  }

  return [...visitorRows.values()].map((profile) => ({
    profileId: profile.id,
    username: profile.username,
    displayName: profile.displayName,
  }));
}

export async function listPublicProfileCheckins(profileId: Id): Promise<Checkin[]> {
  return listProfileCheckins(profileId, { publicOnly: true });
}

export async function listProfileCheckins(profileId: Id, options: { publicOnly?: boolean } = {}): Promise<Checkin[]> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    return checkins
      .filter((checkin) => checkin.profileId === resolvedProfileId && (!options.publicOnly || checkin.privacy === 'public'))
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  }

  let query = supabase
    .from('checkins')
    .select(
      `
      id,
      profile_id,
      scope,
      privacy,
      checked_at,
      rating,
      note,
      photo_urls,
      cities(city,country,latitude,longitude),
      venues(id,name,country,place_provider,provider_place_id,latitude,longitude,city_id),
      beers(id,name,style,abv,ibu,barcode,created_by,created_at,brewery_id)
      `
    )
    .eq('profile_id', resolvedProfileId)
    .order('checked_at', { ascending: false });

  if (options.publicOnly) {
    query = query.eq('privacy', 'public');
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  return mapDbProfileCheckinRows((data ?? []) as DbProfileCheckinRow[]);
}

async function listCheckinsByIds(ids: Id[]): Promise<Checkin[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return [];

  if (!(await canUseSupabaseBackend())) {
    return checkins.filter((checkin) => uniqueIds.includes(checkin.id));
  }

  const { data, error } = await supabase
    .from('checkins')
    .select(
      `
      id,
      profile_id,
      scope,
      privacy,
      checked_at,
      rating,
      note,
      photo_urls,
      cities(city,country,latitude,longitude),
      venues(id,name,country,place_provider,provider_place_id,latitude,longitude,city_id),
      beers(id,name,style,abv,ibu,barcode,created_by,created_at,brewery_id)
      `
    )
    .in('id', uniqueIds);

  if (error) throw new Error(error.message);

  return mapDbProfileCheckinRows((data ?? []) as DbProfileCheckinRow[]);
}

async function mapDbProfileCheckinRows(rows: DbProfileCheckinRow[]): Promise<Checkin[]> {
  const venueCityIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const venue = Array.isArray(row.venues) ? row.venues[0] : row.venues;
          return venue?.city_id;
        })
        .filter((cityId): cityId is string => Boolean(cityId))
    )
  );
  const breweryIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const beer = Array.isArray(row.beers) ? row.beers[0] : row.beers;
          return beer?.brewery_id;
        })
        .filter((breweryId): breweryId is string => Boolean(breweryId))
    )
  );

  const [venueCityRowsResult, breweryRowsResult] = await Promise.all([
    venueCityIds.length
      ? supabase.from('cities').select('id,city,country,latitude,longitude').in('id', venueCityIds)
      : ({ data: [] as Array<DbCity>, error: null } as { data: DbCity[]; error: null }),
    breweryIds.length
      ? supabase.from('breweries').select('id,name').in('id', breweryIds)
      : ({ data: [] as Array<DbBrewery>, error: null } as { data: DbBrewery[]; error: null }),
  ]);

  if (venueCityRowsResult.error) throw new Error(venueCityRowsResult.error.message);
  if (breweryRowsResult.error) throw new Error(breweryRowsResult.error.message);

  const venueCityRows = venueCityRowsResult.data ?? [];
  const breweryRows = breweryRowsResult.data ?? [];

  const venueCityMap = new Map<string, DbCity>(venueCityRows.map((city) => [city.id, city]));
  const breweryMap = new Map<string, DbBrewery>(breweryRows.map((brewery) => [brewery.id, brewery]));

  const mediaUrlsByRef = await resolveCheckinMediaUrlMap(rows.map((row) => row.photo_urls ?? []));
  return rows.map((row) => mapDbProfileCheckin(row, venueCityMap, breweryMap, mapResolvedCheckinMediaUrls(row.photo_urls ?? [], mediaUrlsByRef)));
}

function normalizeTrailTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) {
    throw new Error('Trail title is required.');
  }
  return normalized.slice(0, 100);
}

function nextTrailItemPosition(trail: Trail, requested?: number): number {
  if (requested !== undefined && Number.isInteger(requested) && requested >= 0) {
    return requested;
  }

  const lastPosition = trail.items.reduce((max, item) => Math.max(max, item.position), -1);
  return lastPosition + 1;
}

function normalizeTrailItems(items: TrailItem[]): TrailItem[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({ ...item, position: index }));
}

function trailItemFromInput(trail: Trail, input: CreateTrailItemInput): TrailItem {
  const position = nextTrailItemPosition(trail, input.position);

  if (input.kind === 'checkin') {
    const checkin = checkins.find((candidate) => candidate.id === input.checkinId);
    if (!checkin) {
      throw new Error('Check-in not found.');
    }
    if (checkin.profileId !== trail.profileId) {
      throw new Error('Only your own stamps can be added to this trail.');
    }

    return {
      id: `trail_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      trailId: trail.id,
      kind: 'checkin',
      position,
      checkinId: checkin.id,
      checkin,
      note: input.note?.trim() || undefined,
      createdAt: now(),
    };
  }

  const title = input.title?.trim() || input.venue?.name || input.city?.city || 'Planned stop';
  return {
    id: `trail_item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    trailId: trail.id,
    kind: 'place',
    position,
    venue: input.venue,
    city: input.city,
    title,
    note: input.note?.trim() || undefined,
    createdAt: now(),
  };
}

async function listTrailItemsByTrailIds(trailIds: Id[]): Promise<Map<Id, TrailItem[]>> {
  const byTrail = new Map<Id, TrailItem[]>();
  const uniqueTrailIds = Array.from(new Set(trailIds.filter(Boolean)));
  if (!uniqueTrailIds.length) return byTrail;

  const { data, error } = await supabase
    .from('trail_items')
    .select(trailItemSelect)
    .in('trail_id', uniqueTrailIds)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DbTrailItemRow[];
  const trailCheckins = await listCheckinsByIds(rows.map((row) => row.checkin_id).filter((id): id is string => Boolean(id)));
  const checkinsById = new Map(trailCheckins.map((checkin) => [checkin.id, checkin]));

  for (const row of rows) {
    const item = mapDbTrailItem(row, checkinsById);
    const current = byTrail.get(item.trailId) ?? [];
    current.push(item);
    byTrail.set(item.trailId, current);
  }

  return byTrail;
}

async function mapDbTrailsWithItems(rows: DbTrailRow[]): Promise<Trail[]> {
  const itemsByTrail = await listTrailItemsByTrailIds(rows.map((row) => row.id));
  return rows.map((row) => mapDbTrail(row, itemsByTrail.get(row.id) ?? []));
}

async function buildDbTrailItemPayload(trail: Trail, input: CreateTrailItemInput): Promise<{
  trail_id: string;
  position: number;
  item_type: 'checkin' | 'place';
  checkin_id: string | null;
  venue_id: string | null;
  city_id: string | null;
  title: string | null;
  note: string | null;
}> {
  const position = nextTrailItemPosition(trail, input.position);

  if (input.kind === 'checkin') {
    const matchingCheckin = (await listCheckinsByIds([input.checkinId]))[0];
    if (!matchingCheckin || matchingCheckin.profileId !== trail.profileId) {
      throw new Error('Only your own stamps can be added to this trail.');
    }

    return {
      trail_id: trail.id,
      position,
      item_type: 'checkin',
      checkin_id: input.checkinId,
      venue_id: null,
      city_id: null,
      title: null,
      note: input.note?.trim() || null,
    };
  }

  let cityId: string | null = null;
  let venueId: string | null = null;
  const inputCity = input.city ?? (input.venue
    ? {
        city: input.venue.city,
        country: input.venue.country,
        lat: input.venue.lat,
        lng: input.venue.lng,
      }
    : undefined);

  if (inputCity?.city && inputCity.country && inputCity.lat !== undefined && inputCity.lng !== undefined) {
    const city = await findOrCreateCity(inputCity.city, inputCity.country, inputCity.lat, inputCity.lng);
    cityId = city.id;

    if (input.venue) {
      const venue = await findOrCreateVenue(
        input.venue.name,
        city,
        input.venue.lat,
        input.venue.lng,
        input.venue.provider,
        input.venue.externalId
      );
      venueId = venue.id;
    }
  }

  const title = input.title?.trim() || input.venue?.name || input.city?.city || 'Planned stop';
  return {
    trail_id: trail.id,
    position,
    item_type: 'place',
    checkin_id: null,
    venue_id: venueId,
    city_id: cityId,
    title,
    note: input.note?.trim() || null,
  };
}

export async function listMyTrails(profileId?: Id): Promise<Trail[]> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    return trails
      .filter((trail) => trail.profileId === resolvedProfileId)
      .map(cloneTrail)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const { data, error } = await supabase
    .from('trails')
    .select(trailSelect)
    .eq('profile_id', resolvedProfileId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return mapDbTrailsWithItems((data ?? []) as DbTrailRow[]);
}

export async function listDiscoverTrails(viewerId?: Id): Promise<Trail[]> {
  const resolvedViewerId = await resolveProfileId(viewerId);

  if (!(await canUseSupabaseBackend())) {
    return trails
      .filter((trail) => trail.profileId !== resolvedViewerId && canViewTrail(trail, resolvedViewerId) && trail.privacy !== 'private')
      .map(cloneTrail)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const { data, error } = await supabase
    .from('trails')
    .select(trailSelect)
    .neq('profile_id', resolvedViewerId)
    .neq('privacy', 'private')
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message);
  return mapDbTrailsWithItems((data ?? []) as DbTrailRow[]);
}

export async function getTrail(trailId: Id, viewerId?: Id): Promise<Trail | null> {
  const resolvedViewerId = viewerId ? await resolveProfileId(viewerId) : await resolveProfileId();

  if (!(await canUseSupabaseBackend())) {
    const trail = trails.find((candidate) => candidate.id === trailId);
    if (!trail || !canViewTrail(trail, resolvedViewerId)) return null;
    return cloneTrail(trail);
  }

  const { data, error } = await supabase
    .from('trails')
    .select(trailSelect)
    .eq('id', trailId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const [trail] = await mapDbTrailsWithItems([data as DbTrailRow]);
  return trail ?? null;
}

export async function createTrail(input: CreateTrailInput): Promise<Trail> {
  const profileId = await resolveProfileId(input.profileId);
  const title = normalizeTrailTitle(input.title);
  const privacy = input.privacy ?? 'private';
  const description = input.description?.trim() || undefined;
  const coverImage = input.coverImage?.trim() || undefined;

  if (!(await canUseSupabaseBackend())) {
    const trail: Trail = {
      id: `trail_${Date.now()}`,
      profileId,
      title,
      description,
      privacy,
      coverImage,
      createdAt: now(),
      updatedAt: now(),
      owner: profiles.find((profile) => profile.id === profileId),
      author: profiles.find((profile) => profile.id === profileId),
      items: [],
      itemCount: 0,
    };
    trail.items = normalizeTrailItems((input.items ?? []).map((item) => trailItemFromInput(trail, item)));
    trail.itemCount = trail.items.length;
    trails = [trail, ...trails];
    return cloneTrail(trail);
  }

  const { data, error } = await supabase
    .from('trails')
    .insert({
      profile_id: profileId,
      title,
      description: description ?? null,
      privacy,
      cover_image: coverImage ?? null,
    })
    .select(trailSelect)
    .single();

  if (error) throw new Error(error.message);

  let trail = mapDbTrail(data as DbTrailRow);
  for (const item of input.items ?? []) {
    await addTrailItem(trail.id, item);
    const refreshed = await getTrail(trail.id, profileId);
    if (refreshed) trail = refreshed;
  }

  return trail;
}

export async function updateTrail(trailId: Id, input: UpdateTrailInput): Promise<Trail> {
  const existing = await getTrail(trailId);
  if (!existing) {
    throw new Error('Trail not found.');
  }

  if (!(await canUseSupabaseBackend())) {
    const nextTrail: Trail = {
      ...existing,
      title: input.title !== undefined ? normalizeTrailTitle(input.title) : existing.title,
      description: input.description === null ? undefined : input.description?.trim() || existing.description,
      privacy: input.privacy ?? existing.privacy,
      coverImage: input.coverImage === null ? undefined : input.coverImage?.trim() || existing.coverImage,
      updatedAt: now(),
    };
    trails = trails.map((trail) => (trail.id === trailId ? nextTrail : trail));
    return cloneTrail(nextTrail);
  }

  const payload: {
    title?: string;
    description?: string | null;
    privacy?: PrivacyLevel;
    cover_image?: string | null;
  } = {};
  if (input.title !== undefined) payload.title = normalizeTrailTitle(input.title);
  if (input.description !== undefined) payload.description = input.description?.trim() || null;
  if (input.privacy !== undefined) payload.privacy = input.privacy;
  if (input.coverImage !== undefined) payload.cover_image = input.coverImage?.trim() || null;

  const { data, error } = await supabase
    .from('trails')
    .update(payload)
    .eq('id', trailId)
    .select(trailSelect)
    .single();

  if (error) throw new Error(error.message);
  const [trail] = await mapDbTrailsWithItems([data as DbTrailRow]);
  return trail;
}

export async function deleteTrail(trailId: Id): Promise<void> {
  if (!(await canUseSupabaseBackend())) {
    trails = trails.filter((trail) => trail.id !== trailId);
    return;
  }

  const { error } = await supabase.from('trails').delete().eq('id', trailId);
  if (error) throw new Error(error.message);
}

export async function addTrailItem(trailId: Id, input: CreateTrailItemInput): Promise<TrailItem> {
  const trail = await getTrail(trailId);
  if (!trail) {
    throw new Error('Trail not found.');
  }

  if (!(await canUseSupabaseBackend())) {
    const item = trailItemFromInput(trail, input);
    const nextItems = normalizeTrailItems([...trail.items, item]);
    trails = trails.map((candidate) =>
      candidate.id === trailId
        ? {
            ...candidate,
            items: nextItems,
            itemCount: nextItems.length,
            updatedAt: now(),
          }
        : candidate
    );
    return item;
  }

  const payload = await buildDbTrailItemPayload(trail, input);
  const { data, error } = await supabase
    .from('trail_items')
    .insert(payload)
    .select(trailItemSelect)
    .single();
  if (error) throw new Error(error.message);

  await supabase.from('trails').update({ updated_at: now() }).eq('id', trailId);
  const checkinsById = new Map((await listCheckinsByIds(payload.checkin_id ? [payload.checkin_id] : [])).map((checkin) => [checkin.id, checkin]));
  return mapDbTrailItem(data as DbTrailItemRow, checkinsById);
}

export async function removeTrailItem(trailId: Id, itemId: Id): Promise<void> {
  if (!(await canUseSupabaseBackend())) {
    trails = trails.map((trail) => {
      if (trail.id !== trailId) return trail;
      const items = normalizeTrailItems(trail.items.filter((item) => item.id !== itemId));
      return {
        ...trail,
        items,
        itemCount: items.length,
        updatedAt: now(),
      };
    });
    return;
  }

  const { error } = await supabase.from('trail_items').delete().eq('id', itemId).eq('trail_id', trailId);
  if (error) throw new Error(error.message);
  const remaining = (await getTrail(trailId))?.items ?? [];
  await reorderTrailItems(trailId, remaining.map((item) => item.id));
}

export async function reorderTrailItems(trailId: Id, itemIds: Id[]): Promise<Trail> {
  const existing = await getTrail(trailId);
  if (!existing) {
    throw new Error('Trail not found.');
  }

  const orderMap = new Map(itemIds.map((id, index) => [id, index]));
  const nextItems = normalizeTrailItems(
    [...existing.items].sort((a, b) => {
      const aIndex = orderMap.get(a.id);
      const bIndex = orderMap.get(b.id);
      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if (aIndex !== undefined) return -1;
      if (bIndex !== undefined) return 1;
      return a.position - b.position;
    })
  );

  if (!(await canUseSupabaseBackend())) {
    trails = trails.map((trail) => (trail.id === trailId ? { ...trail, items: nextItems, updatedAt: now() } : trail));
    return cloneTrail(trails.find((trail) => trail.id === trailId)!);
  }

  for (const item of nextItems) {
    const { error } = await supabase
      .from('trail_items')
      .update({ position: item.position })
      .eq('id', item.id)
      .eq('trail_id', trailId);
    if (error) throw new Error(error.message);
  }
  await supabase.from('trails').update({ updated_at: now() }).eq('id', trailId);
  const refreshed = await getTrail(trailId);
  if (!refreshed) throw new Error('Trail not found.');
  return refreshed;
}

export async function createTrailFromCityVisit(profileId: Id, city: string, country: string): Promise<Trail> {
  const resolvedProfileId = await resolveProfileId(profileId);
  const normalizedCity = city.trim();
  const normalizedCountry = country.trim();
  if (!normalizedCity || !normalizedCountry) {
    throw new Error('City and country are required.');
  }

  const cityCheckins = (await listProfileCheckins(resolvedProfileId))
    .filter((checkin) => {
      const checkinCity = checkin.city ?? (checkin.venue
        ? {
            city: checkin.venue.city,
            country: checkin.venue.country,
          }
        : undefined);
      return checkinCity?.city === normalizedCity && checkinCity.country === normalizedCountry;
    })
    .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));

  return createTrail({
    profileId: resolvedProfileId,
    title: `${normalizedCity} beer trail`,
    description: cityCheckins.length
      ? `${cityCheckins.length} saved ${cityCheckins.length === 1 ? 'stamp' : 'stamps'} from ${normalizedCity}.`
      : `A planned beer trail for ${normalizedCity}, ${normalizedCountry}.`,
    privacy: 'private',
    items: cityCheckins.map((checkin, index) => ({
      kind: 'checkin',
      checkinId: checkin.id,
      position: index,
    })),
  });
}

export async function followProfile(followerId: Id, followingId: Id): Promise<void> {
  if (followerId === followingId) return;
  if (await canUseSupabaseBackend()) {
    if (!uuidRegex.test(followerId) || !uuidRegex.test(followingId)) return;
    const { error } = await supabase.from('follows').upsert(
      {
        follower_id: followerId,
        following_id: followingId,
      },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
    );
    if (error) throw new Error(error.message);
    return;
  }

  if (follows.some((f) => f.followerId === followerId && f.followingId === followingId)) return;
  follows = [
    ...follows,
    {
      followerId,
      followingId,
      followedAt: now(),
    },
  ];
}

export async function unfollowProfile(followerId: Id, followingId: Id): Promise<void> {
  if (await canUseSupabaseBackend()) {
    if (!uuidRegex.test(followerId) || !uuidRegex.test(followingId)) return;
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) throw new Error(error.message);
    return;
  }

  follows = follows.filter((f) => !(f.followerId === followerId && f.followingId === followingId));
}

export async function getPassportSummary(profileId?: Id): Promise<PassportSummary> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    const visibleCheckins = checkins.filter((checkin) => checkin.profileId === resolvedProfileId);
    const citiesSet = new Set<string>();
    const countriesSet = new Set<string>();
    const stylesMap = new Map<BeerStyle, number>();
    const brewerySet = new Set<string>();

    for (const checkin of visibleCheckins) {
      const scopeCity = checkin.city ? checkin.city : checkin.venue;
      if (scopeCity) {
        countriesSet.add(scopeCity.country);
        if (scopeCity.city && scopeCity.country) citiesSet.add(cityStampKey(scopeCity));
      }
      if (checkin.beer.brewery?.name) brewerySet.add(checkin.beer.brewery.name);
      stylesMap.set(checkin.beer.style, (stylesMap.get(checkin.beer.style) ?? 0) + 1);
    }

    return {
      countriesCount: countriesSet.size,
      citiesCount: citiesSet.size,
      uniqueBeersCount: new Set(visibleCheckins.map((c) => c.beer.id)).size,
      uniqueBreweriesCount: brewerySet.size,
      checkinsCount: visibleCheckins.length,
      topStyles: [...stylesMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([style, count]) => ({ style, count })),
    };
  }

  const [summaryRow, topStyles] = await Promise.all([
    supabase
      .from('passport_summary')
      .select('profile_id,checkins_count,cities_count,countries_count,unique_beers_count,unique_breweries_count')
      .eq('profile_id', resolvedProfileId)
      .limit(1),
    supabase.rpc('get_passport_top_styles', { p_profile_id: resolvedProfileId }),
  ]);

  if (summaryRow.error) {
    throw new Error(summaryRow.error.message);
  }
  const base = mapDbPassportSummary(summaryRow.data?.[0]);
  if (topStyles.error) {
    throw new Error(topStyles.error.message);
  }
  if (topStyles.data) {
    base.topStyles = (topStyles.data as unknown as DbPassportTopStyle[]).map((entry: DbPassportTopStyle) => ({
      style: entry.style,
      count: toInt(entry.count) ?? 0,
    }));
  }

  return base;
}

export async function listPassportStamps(profileId?: Id): Promise<CityStamp[]> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    const personal = checkins.filter((c) => c.profileId === resolvedProfileId);
    const cityMap = new Map<string, CityStamp>();
    for (const checkin of personal) {
      const city = checkin.city ?? {
        city: checkin.venue?.city ?? 'Unknown',
        country: checkin.venue?.country ?? 'Unknown',
        lat: checkin.venue?.lat ?? 0,
        lng: checkin.venue?.lng ?? 0,
      };

      const key = cityStampKey(city);
      const existing = cityMap.get(key);
      const nextCount = existing ? existing.count + 1 : 1;
      const nextStamp = {
        city: city.city,
        country: city.country,
        lat: city.lat,
        lng: city.lng,
        count: nextCount,
        lastVisitedAt: checkin.checkedAt,
      };
      cityMap.set(key, nextStamp);
    }
    return [...cityMap.values()].sort((a, b) => b.lastVisitedAt.localeCompare(a.lastVisitedAt));
  }

  const { data, error } = await supabase
    .from('city_stamps')
    .select('city,country,latitude,longitude,checkin_count,last_visited_at')
    .eq('profile_id', resolvedProfileId)
    .order('last_visited_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((stamp: DbCityStamp) => ({
    city: stamp.city ?? 'Unknown',
    country: stamp.country ?? 'Unknown',
    lat: toNumber(stamp.latitude) ?? 0,
    lng: toNumber(stamp.longitude) ?? 0,
    count: toInt(stamp.checkin_count) ?? 0,
    lastVisitedAt: stamp.last_visited_at,
  }));
}

export async function listFollowerFeed(viewerId?: Id): Promise<FollowFeedItem[]> {
  const resolvedViewerId = await resolveProfileId(viewerId);

  if (!(await canUseSupabaseBackend())) {
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const followsSet = new Set(follows.filter((f) => f.followerId === resolvedViewerId).map((f) => f.followingId));
    const visible = checkins
      .filter((c) => {
        if (c.profileId === resolvedViewerId) return true;
        if (followsSet.has(c.profileId)) return c.privacy === 'public' || c.privacy === 'followers';
        return c.privacy === 'public';
      })
      .filter((c) => profileMap.has(c.profileId))
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));

    return visible.map((checkin) => {
      const author = profileMap.get(checkin.profileId)!;
      return { checkin, author, followed: followsSet.has(author.id) };
    });
  }

  const { data, error } = await supabase.rpc('get_follower_feed', {
    p_viewer_id: resolvedViewerId,
  });

  if (error) throw new Error(error.message);

  const rows = data as DbFollowFeedRow[] | null | undefined;
  const mediaUrlsByRef = await resolveCheckinMediaUrlMap((rows ?? []).map((row) => row.photo_urls ?? []));
  return (rows ?? []).map((row) => mapDbFollowFeed(row, mapResolvedCheckinMediaUrls(row.photo_urls ?? [], mediaUrlsByRef)));
}

export async function listForYouFeed(viewerId?: Id): Promise<FollowFeedItem[]> {
  const resolvedViewerId = await resolveProfileId(viewerId);

  const [feed, followedProfiles, summary, trips] = await Promise.all([
    listFollowerFeed(resolvedViewerId),
    getFollowedProfiles(resolvedViewerId),
    getPassportSummary(resolvedViewerId),
    listCityTrips(resolvedViewerId),
  ]);

  const scoring: FeedScoringContext = {
    followedProfileIds: new Set(followedProfiles.map((profile) => profile.id)),
    preferredCountries: new Set(trips.map((trip) => trip.country.toLowerCase().trim())),
    preferredStyles: topStylesFromSummary(summary),
  };

  return [...feed]
    .map((item) => ({
      item,
      score: scoreFeedItem(item, scoring),
    }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return b.item.checkin.checkedAt.localeCompare(a.item.checkin.checkedAt);
    })
    .map((entry) => entry.item);
}

export async function listTrendingBeers(profileId?: Id, limit = 5): Promise<string[]> {
  const visible = await listFollowerFeed(profileId);
  const countByBeer = new Map<string, number>();

  for (const item of visible) {
    const beerName = item.checkin.beer.name;
    countByBeer.set(beerName, (countByBeer.get(beerName) ?? 0) + 1);
  }

  return [...countByBeer.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name]) => name);
}

export async function getFollowCounts(profileId?: Id): Promise<{ followers: number; following: number }> {
  const resolvedProfileId = await resolveProfileId(profileId);

  if (!(await canUseSupabaseBackend())) {
    return {
      followers: follows.filter((f) => f.followingId === resolvedProfileId).length,
      following: follows.filter((f) => f.followerId === resolvedProfileId).length,
    };
  }

  const [followersResult, followingResult] = await Promise.all([
    supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', resolvedProfileId),
    supabase
      .from('follows')
      .select('following_id', { count: 'exact', head: true })
      .eq('follower_id', resolvedProfileId),
  ]);

  if (followersResult.error) throw new Error(followersResult.error.message);
  if (followingResult.error) throw new Error(followingResult.error.message);

  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
  };
}

export async function createCheckin(input: CreateCheckinInput, authorId?: Id): Promise<Checkin> {
  const normalizedBeer = input.beerName.trim();
  const normalizedCity = input.city.trim();
  const normalizedCountry = input.country.trim();
  if (!normalizedBeer || !normalizedCity || !normalizedCountry) {
    throw new Error('Beer and city/country are required.');
  }
  if (input.scope === 'venue' && !input.venueName?.trim()) {
    throw new Error('Venue logs require a venue name.');
  }

  const resolvedAuthorId = await resolveProfileId(authorId);
  const useBackend = await canUseSupabaseBackend();

  if (useBackend) {
    await getCurrentProfileOrSeed(resolvedAuthorId);
  }

  const cityLat = input.scope === 'venue' ? input.cityLat : input.lat;
  const cityLng = input.scope === 'venue' ? input.cityLng : input.lng;
  const media = Array.from(new Set((input.media ?? []).map((item) => item.trim()).filter(Boolean))).slice(0, 4);

  if (!useBackend) {
    const city = upsertCity(normalizedCity, normalizedCountry, cityLat, cityLng);
    const beer = upsertBeer(normalizedBeer, input.style, resolvedAuthorId, input.breweryName?.trim(), input.barcode);
    const checkin: Checkin = {
      id: `checkin_${Date.now()}`,
      profileId: resolvedAuthorId,
      beer: normalizeBeer(beer),
      scope: input.scope,
      checkedAt: now(),
      privacy: input.privacy,
      note: input.note?.trim() ? input.note.trim() : undefined,
      rating: normalizeRating(input.rating),
      media,
      ...(input.scope === 'venue'
        ? {
            venue: upsertVenue(input.venueName!.trim(), city, input.lat, input.lng, input.venueProvider ?? 'user', input.venueExternalId),
          }
        : { city }),
    };
    checkins = [checkin, ...checkins];
    return checkin;
  }

  const city = await findOrCreateCity(normalizedCity, normalizedCountry, cityLat, cityLng);
  const beer = await findOrCreateBeer(normalizedBeer, input.style, resolvedAuthorId, input.breweryName?.trim(), input.barcode);
  const venue = input.scope === 'venue' && input.venueName
    ? await findOrCreateVenue(input.venueName.trim(), city, input.lat, input.lng, input.venueProvider ?? 'user', input.venueExternalId)
    : null;

  const payload = {
    profile_id: resolvedAuthorId,
    beer_id: beer.id,
    scope: input.scope,
    city_id: input.scope === 'city' ? city.id : null,
    venue_id: input.scope === 'venue' ? venue?.id : null,
    checked_at: now(),
    privacy: input.privacy,
    rating: normalizeRating(input.rating),
    note: input.note?.trim() || null,
    photo_urls: media,
  };

  const { data, error } = await supabase
    .from('checkins')
    .insert(payload)
    .select('id,checked_at,privacy,rating,note,photo_urls')
    .single();
  if (error) {
    throw new Error(error.message);
  }

  let signedMedia: string[] = [];
  try {
    signedMedia = await resolveCheckinMediaUrls(data.photo_urls ?? []);
  } catch {
    signedMedia = [];
  }

  return {
    id: data.id,
    profileId: resolvedAuthorId,
    beer: {
      id: beer.id,
      name: beer.name,
      style: beer.style,
      abv: toNumber(beer.abv),
      ibu: toInt(beer.ibu),
      brewery: beer.brewery_id
        ? {
            id: beer.brewery_id,
            name: input.breweryName?.trim() ?? 'Unknown',
          }
        : undefined,
      createdBy: beer.created_by ?? resolvedAuthorId,
      createdAt: beer.created_at,
      barcode: beer.barcode ?? undefined,
    },
    scope: input.scope,
    city: input.scope === 'city'
      ? {
          city: city.city,
          country: city.country,
          lat: toNumber(city.latitude) ?? input.lat,
          lng: toNumber(city.longitude) ?? input.lng,
        }
      : undefined,
    venue:
      input.scope === 'venue' && venue
        ? {
            id: venue.id,
            name: venue.name,
            city: venue.city?.city ?? city.city,
            country: venue.country ?? city.country,
            provider: venue.place_provider ?? input.venueProvider ?? 'user',
            externalId: venue.provider_place_id ?? input.venueExternalId,
            lat: toNumber(venue.latitude) ?? input.lat,
            lng: toNumber(venue.longitude) ?? input.lng,
          }
        : undefined,
    checkedAt: data.checked_at,
    privacy: data.privacy,
    rating: normalizeRating(data.rating ?? undefined),
    note: data.note ?? undefined,
    media: signedMedia,
  };
}

const locationHintKey = (hint: LocationHint) =>
  `${hint.provider ?? 'user'}:${hint.externalId ?? ''}:${hint.venueName ?? ''}:${hint.city ?? ''}:${hint.country ?? ''}`.toLowerCase();

const mergeLocationHints = (...hintGroups: LocationHint[][]) => {
  const seen = new Set<string>();
  const merged: LocationHint[] = [];

  for (const hints of hintGroups) {
    for (const hint of hints) {
      const key = locationHintKey(hint);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(hint);
      }
    }
  }

  return merged.slice(0, 10);
};

async function fetchGoogleLocationHints(query: string): Promise<LocationHint[]> {
  if (typeof fetch !== 'function') {
    return [];
  }

  if (!isSupabaseConfigured) {
    return [];
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return [];
  }

  const proxyBase = process.env.EXPO_PUBLIC_HOPPIN_PLACES_PROXY_URL?.trim();
  const endpoint = `${proxyBase ? proxyBase.replace(/\/$/, '') : ''}/api/places?query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { hints?: LocationHint[] };
    return (payload.hints ?? [])
      .filter((hint) => hint.city && hint.country && hint.lat !== undefined && hint.lng !== undefined)
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function fetchGoogleNearbyVenueHints(lat: number, lng: number): Promise<LocationHint[]> {
  if (typeof fetch !== 'function') {
    return [];
  }

  if (!isSupabaseConfigured) {
    return [];
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return [];
  }

  const proxyBase = process.env.EXPO_PUBLIC_HOPPIN_PLACES_PROXY_URL?.trim();
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  const endpoint = `${proxyBase ? proxyBase.replace(/\/$/, '') : ''}/api/places?${params.toString()}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { hints?: LocationHint[] };
    return (payload.hints ?? [])
      .filter((hint) => hint.venueName && hint.city && hint.country && hint.lat !== undefined && hint.lng !== undefined)
      .slice(0, 5);
  } catch {
    return [];
  }
}

async function listStoredVenueOrCityHints(query: string): Promise<LocationHint[]> {
  const q = query.trim();
  if (!q) return [];

  if (!useSupabase()) {
    const qLower = q.toLowerCase();
    const results: LocationHint[] = [];
    for (const venue of venues) {
      if (venue.name.toLowerCase().includes(qLower)) {
        results.push({
          venueName: venue.name,
          city: venue.city,
          country: venue.country,
          lat: venue.lat,
          lng: venue.lng,
          provider: venue.provider,
          externalId: venue.externalId,
        });
      }
    }
    for (const city of cities) {
      const match = `${city.city}, ${city.country}`.toLowerCase().includes(qLower);
      if (
        match &&
        !results.some(
          (r) => r.city?.toLowerCase() === city.city.toLowerCase() && r.country?.toLowerCase() === city.country.toLowerCase()
        )
      ) {
        results.push({ city: city.city, country: city.country, lat: city.lat, lng: city.lng, provider: 'user' });
      }
    }

    return results.slice(0, 10);
  }

  const like = `%${q}%`;
  const [cityRows, venueRows] = await Promise.all([
    supabase
      .from('cities')
      .select('city,country,latitude,longitude')
      .or(`city.ilike.${like},country.ilike.${like}`)
      .limit(8),
    supabase
      .from('venues')
      .select('name,country,place_provider,provider_place_id,latitude,longitude,city_id,city:city_id(city,country)')
      .ilike('name', like)
      .limit(8),
  ]);

  if (cityRows.error) throw new Error(cityRows.error.message);
  if (venueRows.error) throw new Error(venueRows.error.message);

  const unique: LocationHint[] = [];
  const seen = new Set<string>();

  for (const venue of ((venueRows.data as unknown as {
    name: string;
    country?: string | null;
    place_provider?: Venue['provider'] | null;
    provider_place_id?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    city?: { city: string; country: string | null } | { city: string; country: string | null }[];
  }[] | null) ?? [])) {
    const cityRow = Array.isArray(venue.city) ? venue.city[0] : venue.city;
    const item = {
      venueName: venue.name,
      city: cityRow?.city ?? undefined,
      country: cityRow?.country ?? venue.country ?? undefined,
      lat: toNumber(venue.latitude),
      lng: toNumber(venue.longitude),
      provider: venue.place_provider ?? 'user',
      externalId: venue.provider_place_id ?? undefined,
    };
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  for (const city of (cityRows.data as { city: string; country: string; latitude: number | string | null; longitude: number | string | null }[] | null) ?? []) {
    const item = { city: city.city, country: city.country, lat: toNumber(city.latitude), lng: toNumber(city.longitude), provider: 'user' as const };
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique.slice(0, 10);
}

export async function listVenueOrCityHints(query: string): Promise<LocationHint[]> {
  const q = query.trim();
  if (!q) return [];

  const [storedHints, googleHints] = await Promise.all([
    listStoredVenueOrCityHints(q).catch(() => []),
    fetchGoogleLocationHints(q),
  ]);

  return mergeLocationHints(storedHints, googleHints);
}

export async function listNearbyVenueHints(lat: number, lng: number): Promise<LocationHint[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return [];
  }

  return fetchGoogleNearbyVenueHints(lat, lng);
}

function upsertCity(city: string, country: string, lat?: number, lng?: number): CityLocation {
  const existing = cities.find((entry) => entry.city.toLowerCase() === city.toLowerCase() && entry.country.toLowerCase() === country.toLowerCase());
  if (existing) return existing;

  if (lat === undefined || lng === undefined) {
    throw new Error('City coordinates are required for new cities.');
  }

  const next: CityLocation = { city, country, lat, lng };
  cities = [...cities, next];
  return next;
}

function upsertVenue(
  name: string,
  locationCity: CityLocation,
  lat = locationCity.lat,
  lng = locationCity.lng,
  provider: Venue['provider'] = 'user',
  externalId?: string
): Venue {
  const existing = venues.find(
    (v) =>
      (externalId && v.provider === provider && v.externalId === externalId) ||
      (v.name.toLowerCase() === name.toLowerCase() && v.city.toLowerCase() === locationCity.city.toLowerCase())
  );
  if (existing) return existing;

  const next: Venue = {
    id: `venue_${venues.length + 1}`,
    name,
    city: locationCity.city,
    country: locationCity.country,
    provider,
    externalId,
    lat,
    lng,
  };
  venues = [...venues, next];
  return next;
}

function upsertBeer(name: string, style: BeerStyle, profileId: Id, breweryName?: string, rawBarcode?: string) {
  const barcode = normalizeBarcode(rawBarcode);
  const existing = beers.find(
    (b) =>
      (barcode && normalizeBarcode(b.barcode ?? undefined) === barcode) ||
      (b.name.toLowerCase() === name.toLowerCase() && b.style === style)
  );
  if (existing) {
    if (barcode && !existing.barcode) {
      const updated = { ...existing, barcode };
      beers = beers.map((beer) => (beer.id === existing.id ? updated : beer));
      return updated;
    }

    return existing;
  }

  const next: MockBeer = {
    id: `beer_${beers.length + 1}`,
    name,
    style,
    abv: null,
    ibu: null,
    brewery_id: null,
    created_at: now(),
    created_by: profileId,
    createdBy: profileId,
    createdAt: now(),
    barcode: barcode ?? null,
    breweryName,
  };
  beers = [...beers, next];
  return next;
}
