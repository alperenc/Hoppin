# Hoppin Launch Policy

This captures current launch decisions for provider posting, beer data quality, and creator trust controls.

## Check-in Provider Policy

Hoppin launches with first-party check-ins only.

- A Hoppin check-in is the canonical user action and source of truth.
- Venue providers such as Foursquare or Swarm are enrichment/posting integrations, not required write paths.
- Provider posting should ship later as an explicit opt-in per account and per check-in.
- The app should never silently post to external venue networks when a user stamps a pour in Hoppin.

Implementation implication: keep `checkins`, `venues`, and `cities` as the canonical model. Store provider IDs for lookup and dedupe, but do not add a dual-post write path until the user can connect a provider account and choose external posting.

## Beer Data Quality

Hoppin treats user-entered beers as the first source of record, with scan/dataset enrichment layered on top.

- Barcode scans should dedupe beer records when a barcode is known.
- Manual beer creation remains allowed for local, seasonal, and unmapped beers.
- External beer datasets can prefill names, breweries, styles, ABV, and imagery, but they should not block check-in creation.
- Dataset conflicts should preserve the user's saved beer/check-in and attach external metadata only when confidence is high.

Launch data sources:

- Barcode-backed Hoppin beer records.
- User-created beers and breweries.
- Optional brewery directory enrichment after the check-in flow is stable.

## Creator Trust Controls

Creator mode is a profile role, not a verification badge.

- Any signed-in user can choose explorer or creator mode during onboarding.
- Verification is a separate future trust signal and should not be implied by `is_creator`.
- Discover surfaces can rank creators, but the launch build should avoid claiming identity verification.
- Anti-spam starts with authenticated writes, owner-only mutations, privacy controls, and conservative public discovery.

Recommended next controls before wider public launch:

- Add a `verified_at` or `verification_status` field if verified creators become part of the product.
- Add report/block flows before broad public feed distribution.
- Keep check-in visibility defaulting to followers until users deliberately choose public.
- Make external posting opt-in only after account connection and per-post confirmation.
