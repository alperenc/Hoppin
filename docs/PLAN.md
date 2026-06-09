# Hoppin Execution Plan

## What is built now
- Seeded follow-first social model:
  - Profiles and follows in `src/lib/hoppin.ts`
  - Home feed with followers-first visibility (`public` and `followers`)
  - Discover screen with creator/explorer follow actions
  - Passport summary + city stamps
  - Passport map view using `react-native-maps` on native platforms
- Check-in composer for venue or city scope + privacy + rating + optional coords
  - Local Supabase schema scaffold in `supabase/migrations/0001_hoppin_core.sql`
- Auth route and session gating:
  - `app/index.tsx` routes to `/auth` when Supabase mode is configured but no session exists.
  - `src/lib/auth.ts` centralizes auth helpers and sign-out/session-change subscriptions.
  - `app/auth.tsx` supports email sign-in/sign-up flow.
  - `app/_layout.tsx` listens for auth session state changes and routes back to `/auth` on sign-out.
- Location enrichment in check-in:
  - `app/checkin.tsx` now suggests venues/cities from `listVenueOrCityHints()`.
  - `app/checkin.tsx` can also prefill latitude/longitude and attempt reverse-geocoded city/country from device location.

## Near-term implementation plan (2 weeks)
1. **Backend integration (critical)**
   - Replace seeded in-memory service calls with Supabase queries. ✅
   - Add RPCs/views for:
     - follower feed
     - passport summary
     - city-stamp map data
   - Add migration constraints/indexes for city uniqueness, check-in shape, and follower visibility.
   - Enforce auth for profiles and follows. Next: finalize app auth session flow after schema stabilization.

2. **Location + beer enrichment**
   - Add optional Google Places/Maps autocomplete + geocoding for check-in location.
   - Persist coordinates, country, city and normalized venue references.
   - Add barcode/label scan (optional) to support beer lookup and dedupe.

3. **Social surface hardening**
   - ✅ Replace plain discovery list with:
     - ✅ Suggested creators
     - ✅ Suggested explorers
     - ✅ follow-state markers (`mutual`, `follows you`; pending is future)
   - ✅ Add profile pages:
     - ✅ creator badges
     - ✅ follower counts and public check-ins
     - ✅ shareable profile/slug

4. **Map and travel surface**
   - ✅ Add country-level filter chips on passport.
   - ✅ Add trip/grouped timeline by city.
   - ✅ Add public city card that shows who else checked in this city.

5. **Influencer loop**
   - ✅ Introduce manual/explicit creator roles.
   - ✅ Add "who do you follow?" onboarding for new users.
   - ✅ Add default ranking of posts from followed creators with "for you" fallback by country/beer style.

## Open questions before launch
- Foursquare/Swarm integration policy for posting:
  - create dual-post model (local feed + optional venue check-in provider post), or
  - keep first-party check-in only until product-market fit.
- Beer dataset quality:
  - Open Brewery DB for base data
  - Manual brewery add-on flow for unmapped local brands
- Influencer launch policy:
  - account verification and anti-spam controls
  - private profile defaults and discoverability settings
