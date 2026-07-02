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
- Do not manually request a re-review while a `👀` reaction shows one is
  already in progress; wait for it to finalize.
- When a review finding is valid, react `👍` on the finding once it is fixed
  in code and resolve the thread. Do not add a reply comment unless there is
  a specific reason to explain something the fix doesn't make obvious on its
  own (e.g. why an alternative approach was rejected).
- When a review finding is out of scope for the current PR (e.g. a
  design/scale/observability concern rather than a correctness or security
  bug in the current diff), file a GitHub issue for it — or fold it into an
  existing open issue covering the same underlying concern — react `👍`,
  reply pointing at the issue, and resolve the thread. Decide this
  autonomously; do not ask before filing or merging on this basis.
- For independent supplemental review (beyond the repo's configured
  automated reviewer), use the `opencode` CLI. Have it fetch the diff and
  post its own findings directly to GitHub via `gh` (inline PR review
  comments, or a top-level PR comment if it found nothing) rather than
  relaying findings through the assistant unfiltered — the assistant
  verifies/dispositions findings in the open (reply + resolve, or file an
  issue) the same as for the primary automated reviewer, not by filtering
  them before they're visible on the PR.
- Merging is autonomous, gated purely on process, not on a human "go ahead"
  for each PR: after every push to a PR, ensure a fresh review runs (wait
  for the automated reviewer if push-triggered, or trigger `opencode` and/or
  `@codex review` if not) and every resulting thread is either resolved via
  a code fix or turned into a tracked issue per the rule above. Once checks
  are green, merge state is clean, and the review from the *current* head
  commit is accounted for, merge without waiting for separate approval.
  Hoppin is pre-launch (no real users or revenue at stake), which is why
  most changes are cheap enough to reverse that this default applies broadly
  — the hard-stop exceptions below exist independent of launch state and
  don't loosen as the product matures.
- Hard stops — always get explicit human approval before merging, regardless
  of review/check state, launch stage, or how confident the diff looks:
  - Any change to secrets scope or handling: which env vars exist, which
    keys they hold, where they're read (client vs. server-only), or who/what
    can access a value like `SUPABASE_SERVICE_ROLE_KEY`.
  - Any change to Row Level Security (RLS) policies, grants, or
    security-relevant triggers on any Supabase table. This class of change
    is exactly what caused the multi-round security findings on PR #43 —
    RLS mistakes are easy to write in a way that looks correct and passes
    typecheck/tests while still being exploitable.
  - Any change to billing-relevant configuration: Vercel plan/usage
    settings, API keys tied to paid quotas, anything that could change what
    the project is charged for.
  - Any production data mutation run outside of normal app code paths (e.g.
    a one-off script or manual Supabase dashboard query against the live
    database).

## Working An Issue Queue Autonomously

- When picking up an open issue to work on: read it in full, implement on a
  new branch per the branching rules above, open a PR referencing the issue,
  and run it through the full review-gate cycle above before merging.
- If an issue requires a decision with real, non-obvious tradeoffs (choice
  of library/backend, a breaking API change) and the issue text doesn't
  already settle it, make the call and record the reasoning in the PR
  description rather than blocking — this matches how issues #45/#46
  themselves were scoped. Stop and surface the question instead if the
  decision falls under a hard stop above, or is otherwise genuinely
  irreversible/expensive to unwind in a way the hard stops don't already
  cover.
- If work on an issue gets stuck (blocked on a missing decision, a flaky
  check that won't go green, an unclear requirement), don't spin on it
  silently. Post a comment on the issue explaining the blocker, leave the
  branch/PR (if one exists) open, and move to the next issue in the queue
  rather than retrying indefinitely.
- Work one issue at a time to completion (merged, explicitly blocked, or
  handed off per the above) before starting the next, so the branch/PR/
  review state never overlaps across issues.

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
- Configure `SUPABASE_SERVICE_ROLE_KEY` in Vercel for the deployed `/api/places-refresh` function. This key bypasses RLS — never expose it as `EXPO_PUBLIC_*`, never call it from client code, and only use it inside server-side Vercel functions.
- Do not commit API keys or other secrets.

## Data + Runtime Discipline

- For schema changes, update migration SQL and any dependent service assumptions together.
- Keep seeded service behavior aligned with DB/API contracts while backend migration is in progress.
- Use `docs/PLAN.md` as the source of truth for feature-state status.

## Git Hygiene

- Before pushing, ensure work is scoped and does not mix unrelated refactors.
- Keep fixups small and targeted.
- Do not use `git commit --no-verify` as a replacement for a working local check.
