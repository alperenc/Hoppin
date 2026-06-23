# Hoppin Execution Plan

## What is built now
- Seeded follow-first social model:
  - Profiles and follows in `src/lib/hoppin.ts`
  - Home tap-trail feed with crew-first ranking, live stamp cards, feed stats, and refresh
  - Discover screen with creator/explorer relationship cards, mutual/follower states, and follow actions
  - Passport summary + city stamps
  - Passport map view using `react-native-maps` on native platforms and Google Maps JS on web
- Passport-stamp composer with inferred venue/city scope, live stamp preview, hidden coordinate capture, collapsed details, privacy, rating, and notes
  - Optional pour photos upload to private Supabase Storage, save through the existing check-in media field as object paths, and render through signed URLs in feed/profile surfaces.
  - Local Supabase schema scaffold in `supabase/migrations/0001_hoppin_core.sql`
- Auth route and session gating:
  - `app/index.tsx` shows a guest passport start screen when Supabase mode is configured but no session exists.
  - `src/lib/auth.ts` centralizes auth helpers and sign-out/session-change subscriptions.
  - `app/auth.tsx` supports Google OAuth plus email sign-in/sign-up flow.
  - `app/_layout.tsx` listens for auth session state changes and routes signed-out users back to the guest start screen.
  - Onboarding and profile screens let signed-in users claim and edit their display name and public handle.
- Location enrichment in check-in:
  - `app/checkin.tsx` now suggests venues/cities from `listVenueOrCityHints()`.
  - `app/checkin.tsx` can also prefill latitude/longitude, best-guess a nearby venue, and fall back to reverse-geocoded city/country from device location.
  - Deployed web can merge saved Hoppin places with Google Places suggestions through `/api/places` when `GOOGLE_PLACES_API_KEY` is configured.
- Beer enrichment in check-in:
  - `app/checkin.tsx` can scan beer can/label barcodes on native builds and reuse existing beer records by barcode.

## Near-term implementation plan (2 weeks)
1. **Backend integration (critical)**
   - Replace seeded in-memory service calls with Supabase queries. ✅
   - Add RPCs/views for:
     - follower feed ✅
     - passport summary ✅
     - city-stamp map data ✅
   - Add migration constraints/indexes for city uniqueness, check-in shape, and follower visibility. ✅
   - Enforce auth for profiles and follows. ✅
   - Finalize app auth session flow after schema stabilization. ✅
   - Add Google OAuth sign-in while keeping email/password fallback. ✅

2. **Location + beer enrichment**
   - Add optional Google Places/Maps autocomplete + geocoding for check-in location. ✅
   - Persist coordinates, country, city and normalized venue references. ✅
   - Add barcode/label scan (optional) to support beer lookup and dedupe. ✅

3. **Social surface hardening**
   - ✅ Replace scaffold home/discover surfaces with app-like feed and relationship screens.
   - ✅ Replace plain discovery list with:
     - ✅ Suggested creators
     - ✅ Suggested explorers
     - ✅ follow-state markers (`mutual`, `follows you`; pending is future)
   - ✅ Add profile pages:
     - ✅ creator badges
     - ✅ follower counts and public check-ins
     - ✅ shareable profile/slug
     - ✅ editable display name, handle, and uploaded profile picture

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
  - Decision: keep first-party check-in only until product-market fit. External venue posting is future opt-in. See `docs/LAUNCH_POLICY.md`.
- Beer dataset quality:
  - Decision: user-created beers and barcode-backed records are canonical at launch. Dataset enrichment must be optional and non-blocking. See `docs/LAUNCH_POLICY.md`.
- Influencer launch policy:
  - Decision: creator mode is not verification; verification and report/block flows are future trust controls. Keep public distribution conservative. See `docs/LAUNCH_POLICY.md`.
