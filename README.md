# Hoppin

Hoppin is a traveler-first social check-in app for beer experiences: record beers by venue or city, and build a world map of your tasting passport.

## Current implementation

The app now includes an influencer-first social model with creator discovery, follower feed, Supabase auth, and a local preview fallback for unconfigured development builds.

- Creator-driven follows graph (`follows`) drives discovery and feed ranking.
- Signed-in users can claim and edit their profile display name, public handle, and profile picture.
- Check-ins support venue or city scope plus optional photo media uploaded through Supabase Storage.
- Passport tab computes city/country/count metrics from personal activity.
- Passport tab now includes a native map of city stamps (web fallback list view).
- Check-in composer persists a new record and returns to feed.
- Auth routing: unauthenticated sessions in Supabase builds are sent to `/auth` for Google OAuth or email sign-in/signup, and signed users land in tabs.
- Check-in now includes venue/city suggestions from local seed data, Supabase hint search, and optional Google Places enrichment through the deployed `/api/places` proxy.
- Native check-in can scan beer can/label barcodes and dedupe against existing beer records.
- Profile pictures use the public `hoppin-avatars` Supabase Storage bucket; check-in photos use the private `hoppin-checkins` bucket and signed URLs in configured builds.

Implementation plan for full production rollout is tracked in [/docs/PLAN.md](/docs/PLAN.md).

### Stack
- Expo + Expo Router
- Supabase (Postgres schema in `supabase/migrations/0001_hoppin_core.sql`)
- Google Maps/Places for optional check-in location enrichment

## Running

1. Install dependencies: `npm install`
2. Set values in `.env.local` from `.env.example`
3. Start app: `npx expo start`

For deployed web, configure these keys in Vercel:

- `GOOGLE_PLACES_API_KEY` enables live Google Places suggestions through the server-side `/api/places` proxy, and re-verifying stale venue data through `/api/places-refresh`.
- `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY` enables Google Maps JS tiles on the web Passport map.
- `SUPABASE_SERVICE_ROLE_KEY` lets `/api/places-refresh` write a venue's refreshed name/coordinates after confirming them against Google directly. Never expose this key to the client.

The Places and service-role keys stay server-only. The Maps web key is intentionally public, so restrict it in Google Cloud to the Hoppin web domains and the Maps JavaScript API.

## Google sign-in setup

Enable the Google provider in Supabase Auth and store the Google OAuth client ID/secret in the Supabase dashboard. In Google Cloud, use the Supabase callback URL as an authorized redirect URI:

- `https://<project-ref>.supabase.co/auth/v1/callback`

Add Hoppin app redirects to the Supabase Auth redirect allow list:

- `https://<your-hoppin-web-domain>/auth`
- `http://localhost:8081/auth`
- `hoppin://auth`

On web, Hoppin sends OAuth users back to the current browser origin plus `/auth`, so each deployed production or preview domain that supports sign-in needs its exact `/auth` URL in this allow list.

## Data model snapshot

- Follow-first social graph: `public.follows`
- Passport-aware content: `public.checkins`, `public.venues`, `public.cities`, `public.beers`
- Public view: `public.passport_summary`
- City stamps view: `public.city_stamps`
