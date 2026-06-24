export type PrivacyLevel = 'private' | 'followers' | 'public';

export type MediaType = 'photo' | 'qr' | 'label';

export type BeerStyle =
  | 'ipa'
  | 'pilsner'
  | 'lager'
  | 'porter'
  | 'stout'
  | 'wheat'
  | 'amber'
  | 'sour'
  | 'experimental'
  | 'other';

export interface Profile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isCreator: boolean;
  createdAt: string;
}

export interface Follow {
  followerId: string;
  followingId: string;
  followedAt: string;
}

export interface Brewery {
  id: string;
  name: string;
  city?: string;
  country?: string;
  website?: string;
}

export interface Beer {
  id: string;
  name: string;
  style: BeerStyle;
  abv?: number;
  ibu?: number;
  brewery?: Brewery;
  imageUrl?: string;
  createdBy: string;
  createdAt: string;
  barcode?: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  provider: 'google' | 'user' | 'osm';
  externalId?: string;
  lat: number;
  lng: number;
}

export interface CityLocation {
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface LocationHint {
  venueName?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  provider?: Venue['provider'];
  externalId?: string;
}

export type CheckinScope = 'venue' | 'city';

export interface Checkin {
  id: string;
  profileId: string;
  beer: Beer;
  scope: CheckinScope;
  venue?: Venue;
  city?: CityLocation;
  checkedAt: string;
  privacy: PrivacyLevel;
  rating?: number;
  note?: string;
  media?: string[];
}

export interface Trip {
  id: string;
  profileId: string;
  city: CityLocation;
  label: string;
  startedAt: string;
  endedAt?: string;
}

export type TrailItemKind = 'checkin' | 'place';

export interface TrailItem {
  id: string;
  trailId: string;
  kind: TrailItemKind;
  position: number;
  checkinId?: string;
  checkin?: Checkin;
  venue?: Venue;
  city?: CityLocation;
  title?: string;
  style?: BeerStyle;
  checkedAt?: string;
  note?: string;
  createdAt: string;
}

export interface Trail {
  id: string;
  profileId: string;
  title: string;
  description?: string;
  privacy: PrivacyLevel;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
  owner?: Profile;
  author?: Profile;
  items: TrailItem[];
  itemCount: number;
}

export type CreateTrailItemInput =
  | {
      kind: 'checkin';
      checkinId: string;
      position?: number;
      note?: string;
    }
  | {
      kind: 'place';
      title?: string;
      venue?: Venue;
      city?: CityLocation;
      position?: number;
      note?: string;
    };

export interface CreateTrailInput {
  profileId?: string;
  title: string;
  description?: string;
  privacy?: PrivacyLevel;
  coverImage?: string;
  items?: CreateTrailItemInput[];
}

export interface UpdateTrailInput {
  title?: string;
  description?: string | null;
  privacy?: PrivacyLevel;
  coverImage?: string | null;
}

export interface PassportSummary {
  countriesCount: number;
  citiesCount: number;
  uniqueBeersCount: number;
  uniqueBreweriesCount: number;
  checkinsCount: number;
  topStyles: { style: BeerStyle; count: number }[];
}

export interface FollowFeedItem {
  checkin: Checkin;
  author: Profile;
  followed: boolean;
}

export interface CityStamp {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  lastVisitedAt: string;
}

export interface CityVisit {
  city: string;
  country: string;
  firstVisitedAt: string;
  lastVisitedAt: string;
  checkinCount: number;
}

export interface CityVisitor {
  profileId: string;
  username: string;
  displayName: string;
}
