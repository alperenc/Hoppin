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
- Never merge a PR with failing GitHub checks. This includes failures caused by
  billing, runner availability, missing secrets, flaky jobs, or external
  service issues. Fix the underlying issue, rerun the checks, and merge only
  after GitHub reports the PR checks are passing or not required.
- Local verification can support debugging, but it is not a substitute for
  passing GitHub PR checks when a workflow is configured.
- If an automated review has been requested, do not merge while it is pending
  or only acknowledged. Wait for the review to either report no findings or
  provide actionable threads, then address and resolve those threads before
  merging.

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
- Configure `GOOGLE_PLACES_API_KEY` in Vercel for the deployed `/api/places` proxy. Use `.env.local` only when running Vercel functions locally.
- `EXPO_PUBLIC_HOPPIN_PLACES_PROXY_URL` is optional for non-web/native clients that need to call a deployed Hoppin web host for place suggestions.
- Do not commit API keys or other secrets.

## Data + Runtime Discipline

- For schema changes, update migration SQL and any dependent service assumptions together.
- Keep seeded service behavior aligned with DB/API contracts while backend migration is in progress.
- Use `docs/PLAN.md` as the source of truth for feature-state status.

## Git Hygiene

- Before pushing, ensure work is scoped and does not mix unrelated refactors.
- Keep fixups small and targeted.
- Do not use `git commit --no-verify` as a replacement for a working local check.
