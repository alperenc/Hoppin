# AGENTS.md

Agent-facing operating notes for `Hoppin`.

This file is the repo-specific workflow and validation guide to use by default.

## Read First

- `README.md` for product context and current implementation status.
- `docs/PLAN.md` for in-flight scope and what counts as complete.
- `supabase/migrations/0001_hoppin_core.sql` before changing data shapes.
- `src/lib/hoppin.ts`, `src/lib/auth.ts`, and `src/lib/onboarding.ts` when touching social/auth/onboarding behavior.

## Branching And PR Defaults

- Current repository default is a single long-lived branch model (`main`) unless a release strategy is formally introduced.
- Start work on short-lived branches and keep each PR scoped:
  - `feat/*` for feature work
  - `fix/*` for bug fixes
  - `chore/*` for maintenance
  - `docs/*` for documentation
- Prefer squash merges for cleaner history unless a broader strategy is explicitly requested.
- PRs should include:
  - **Summary**
  - **Verification**
- PR titles should use conventional style, e.g. `feat: ...`, `fix(hoppin): ...`, `docs: ...`.
- Avoid custom prefixes such as `[codex]` in titles.

## Validation Defaults

Run the narrowest checks that match the change:

- `npm install` after dependency changes.
- `npx tsc --noEmit` for every code/config change that touches TypeScript.
- `npx expo start` to validate app boot and navigation flow (reuse an existing running dev server when available).
- For auth/onboarding/navigation work, verify these path contracts manually:
  - unauthenticated users route to `/auth`
  - first-time users route to `/onboarding`
  - protected screens in `(tabs)` render once session + onboarding state are valid.

## Config And Secrets

- Store local values in `.env.local` and keep it out of source control.
- Copy from `.env.example` and fill:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY`
  - `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- Do not commit API keys or other secrets.

## Data + Runtime Discipline

- For schema changes, update migration SQL and any dependent service assumptions together.
- Keep seeded service behavior aligned with DB/API contracts while backend migration is in progress.
- Use `docs/PLAN.md` as the source of truth for feature-state status.

## Git Hygiene

- Before pushing, ensure work is scoped and does not mix unrelated refactors.
- Keep fixups small and targeted.
- Do not use `git commit --no-verify` as a replacement for a working local check.
