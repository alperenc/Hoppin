# Hoppin

Hoppin is a traveler-first social check-in app for beer experiences: record beers by venue or city, and build a world map of your tasting passport.

## Current implementation

The app now includes an influencer-first social model with creator discovery, follower feed, Supabase auth, and a local preview fallback for unconfigured development builds.

- Creator-driven follows graph (`follows`) drives discovery and feed ranking.
- Signed-in users can claim and edit their profile display name and public handle.
- Check-ins support venue or city scope.
- Passport tab computes city/country/count metrics from personal activity.
- Passport tab now includes a native map of city stamps (web fallback list view).
- Check-in composer persists a new record and returns to feed.
- Auth routing: unauthenticated sessions in Supabase builds are sent to `/auth` for Google OAuth or email sign-in/signup, and signed users land in tabs.
- Check-in now includes venue/city suggestions from local seed data, Supabase hint search, and optional Google Places enrichment through the deployed `/api/places` proxy.
- Native check-in can scan beer can/label barcodes and dedupe against existing beer records.

Implementation plan for full production rollout is tracked in [/docs/PLAN.md](/docs/PLAN.md).

### Stack
- Expo + Expo Router
- Supabase (Postgres schema in `supabase/migrations/0001_hoppin_core.sql`)
- Google Maps/Places for optional check-in location enrichment

## Running

1. Install dependencies: `npm install`
2. Set values in `.env.local` from `.env.example`
3. Start app: `npx expo start`

For deployed web, configure `GOOGLE_PLACES_API_KEY` in Vercel to enable live Google Places suggestions. The Expo client reads suggestions from the same-origin `/api/places` proxy so the Places key does not need to be exposed in the web bundle.

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
