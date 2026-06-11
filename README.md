# Hoppin

Hoppin is a traveler-first social check-in app for beer experiences: record beers by venue or city, and build a world map of your tasting passport.

## Current implementation

The app now includes an influencer-first social model with creator discovery and follower feed. It uses a seeded local service layer with a clear path to Supabase.

- Creator-driven follows graph (`follows`) drives discovery and feed ranking.
- Check-ins support venue or city scope.
- Passport tab computes city/country/count metrics from personal activity.
- Passport tab now includes a native map of city stamps (web fallback list view).
- Check-in composer persists a new record and returns to feed.
- Auth routing: unauthenticated sessions in Supabase builds are sent to `/auth` for email sign-in/signup, and signed users land in tabs.
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

## Data model snapshot

- Follow-first social graph: `public.follows`
- Passport-aware content: `public.checkins`, `public.venues`, `public.cities`, `public.beers`
- Public view: `public.passport_summary`
- City stamps view: `public.city_stamps`
