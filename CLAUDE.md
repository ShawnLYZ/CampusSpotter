# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CampusSpotter is an early-warning and action-planning website for Asia Pacific University (APU) management. It predicts how disruptions (stadium concerts, heavy rain, Friday prayer, intakes, holidays) overload the APU ↔ LRT Bukit Jalil shuttle and the campus. Managers test responses ("levers") and pick one of three costed plans. Stack: React 19 + Vite + Tailwind 4 + Three.js (react-three-fiber) in the browser, Supabase (Postgres, Auth, Realtime, Edge Functions, pg_cron) on the server, Gemini for AI, Google Maps/Routes for traffic.

The app is Supabase-only. The Phase 1 demo provider and presenter mode have been removed, so ignore older plan docs that mention them.

## Commands

Node 24+ is required: scripts run as `node scripts/x.ts` with native type stripping. That is why `tsconfig.json` sets `erasableSyntaxOnly`: no `enum`, `namespace` or constructor parameter properties anywhere. There is no linter.

```bash
npm run dev                 # Vite on http://localhost:5173 (strictPort)
npm run typecheck           # tsc --noEmit over src, shared, scripts, tests
npm run build               # typecheck + vite build into dist/
npm test                    # Vitest unit tests (shared/, src/, scripts/)
npx vitest run shared/engine/forecast.test.ts       # one file
npx vitest run -t "peak APU wait"                   # by test name
npm run test:edge           # Deno tests for supabase/functions (Deno must be installed)
deno test --config supabase/functions/deno.json --allow-read --allow-env supabase/functions/ai-plans   # one function
npm run test:integration    # live Supabase tests; read .env + .env.local; skipped when credentials are missing
npm run check:secrets       # build, then scan dist/ for server secrets
```

Live-project scripts (all read `.env`; account scripts also read `.env.local`):

```bash
node --env-file=.env scripts/run-job.ts sync-weather           # trigger a scheduled job now, as pg_cron does
node --env-file=.env --env-file=.env.local scripts/smoke-functions.ts   # call every deployed function as the demo user, then clean up
node --env-file=.env scripts/db-sql.ts --query "select 1"      # run SQL via the Management API (or --file <path>)
npm run db:seed             # regenerate supabase/seed/phase2-seed.sql from shared/fixtures/rows, then run it
npx supabase functions deploy --use-api                        # deploy all 15 Edge Functions
```

The `data:*` scripts capture raw source snapshots into `shared/fixtures`.

## Architecture

### One codebase, three runtimes

`shared/` is imported by the browser (Vite), by Node (scripts and Vitest) and by Deno (Edge Functions). So inside `shared/`:

- Use only relative imports with explicit `.ts` extensions. The `@engine`, `@bundle`, `@parsers`, `@plans` and `@fixtures` aliases exist only in Vite and tsconfig. Use them from `src/`, never from `shared/` or `supabase/`.
- Do not import npm packages (Vitest in tests is the only exception).

Edge Functions reach shared code through re-export shims: `supabase/functions/_shared/{engine,bundle,parsers}.ts`. Edge code cannot import from `src/`. `supabase/functions/_shared/api.ts` copies the API types from `src/providers/types.ts`, so change both together.

### Forecast engine (`shared/engine`)

This is the core of the product. It is deterministic: the same `InputBundle` and `LeverSet` always give the same output. A day runs from 7:00 AM to 2:00 AM MYT in 76 steps of 15 minutes (`grid.ts`). The main entry points are `runForecast`, `compareScenarios` (no action vs. with plan), `evaluatePlan`, `scoreRisk` and `priceLevers`.

The same engine runs in two places. The browser uses it so the 3D campus and Scenario Lab update instantly. The Edge Functions use it so risk ratings, saved forecasts and plans match the browser exactly.

`ENGINE_VERSION` (`version.ts`) is stored with every saved forecast and is part of the `ai-plans` cache key. When engine behaviour changes, bump it and update `version.test.ts`, which pins the value.

`shared/engine/replay.test.ts` is the product's acceptance test for the 4 Nov concert replay. With no action the day must rate Critical. The plan in `shared/plans/replayPlan.ts` must cut peak APU-stop wait by at least 70% for RM 2,000 or less. `shared/fixtures/rows/CALIBRATION.md` records the calibration.

### From database rows to forecast

`shared/bundle` turns table rows into an engine input: `fetchBundleRows(rowsClient, date)` → `assembleBundle(rows, opts)` → `InputBundle`. `RowsClient` is a one-method interface (`select(table, filters)`) with three implementations:

- `supabaseRowsClient` (`src/providers/supabase/rowsClient.ts`): the browser. It pages past PostgREST's 1,000-row cap, ordering by primary key.
- `repo.rows`: the Edge Functions.
- `memoryRowsClient`: tests, over `shared/fixtures/rows` (`fixtureTables`).

The table names and row shapes in `shared/bundle/rows.ts`, `supabase/functions/_shared/repo.ts` and `scripts/build-seed.ts` all copy `supabase/migrations/20261105000002_core_tables.sql`. Keep them in step with any schema change.

### Browser app (`src/`)

- `DataProvider` (`src/providers/DataProvider.ts`) is the whole client API. Its only implementation is `createSupabaseProvider`. Pages get it with `useProvider()` (`src/app/ProviderContext.tsx`).
- `src/providers/supabase/no-fixtures.test.ts` fails the build if the Supabase provider references fixture data.
- `useForecast(ctx, levers)` (`src/hooks/useForecast.ts`) loads and caches the bundle for each context and runs `compareScenarios` in the browser. It clears its cache on the `disruptions` and `baseline` Realtime channels. Gemini is called only when `refreshEstimates: true` is passed (Scenario Lab).
- Zustand stores live in `src/store`: `context` (date and disruption), `levers` and `time` (playback step). `normalise()` in `context.ts` marks the 4 Nov Weeknd context as the only `reconstructed` one.
- Routes are in `src/app/routes.tsx`. Every page except `/login` sits behind `RequireAuth`.
- Vitest runs only `*.test.ts` files in a Node environment. There are no React component or DOM tests, so keep testable logic in plain `.ts` modules.

### Edge Functions (`supabase/functions`)

Each function has two files:

- `index.ts` builds the real dependencies (admin client, repo, `callGemini`, env) and calls `Deno.serve`.
- `handler.ts` exports `handle(req, deps)`. Tests call it with `_shared/testkit.ts` (`seededRepo()` is an in-memory repo over the fixtures; `fakeGemini()`) and with the recorded Gemini replies in `shared/fixtures/recorded/gemini`.

`supabase/config.toml` sets `verify_jwt = false` on every function because each one checks access itself:

- User-facing functions read the `Authorization: Bearer <user JWT>` header and look up the caller's role (`manager` or `demo`) in `profiles` (`_shared/auth.ts`, `_shared/request.ts`).
- Scheduled jobs (`sync-*`, `event-scan`) accept only the project's `sb_secret_` key on the `apikey` header. pg_cron sends it from Vault. Jobs run through `runJob` (`_shared/jobs.ts`), which records each run in `job_runs`.

Gemini (`_shared/gemini.ts`, model in `GEMINI_MODEL`) never produces a metric value. It can only:

- estimate a closed list of unknowns (`ESTIMATE_KEYS`, clamped by `clampEstimate`)
- propose lever sets (checked by `coerceLevers` against `LEVER_CATALOGUE`)
- write explanations, answers and the student announcement
- extract events in `event-scan`

The engine computes every number. AI replies are cached by a hash of the function name, `PROMPT_VERSION` (`_shared/prompts.ts`), `ENGINE_VERSION` and the inputs. Bump `PROMPT_VERSION` whenever a prompt or response schema changes.

On the free Gemini key, `event-scan`'s grounded search is usually rate-limited. When that happens, the scan falls back to fetching Google News RSS, Live Nation and APU pages (`method: fallback` in `job_runs`). This is normal, not a bug.

### Database and keys

- Migrations live in `supabase/migrations`. Row Level Security lets any signed-in user read. Only `is_manager()` can write disruptions, sources and baseline values. The demo (guest) account can also write forecasts, plans, decisions, checklist items and announcements (PRD §3.11), so UI copy must not call it view-only.
- The README's website setup (Part C, Step C4) lists every migration file by name, so update it when you add one.
- Only the new Supabase keys are accepted (`sb_publishable_…`, `sb_secret_…`). Legacy `eyJ…` anon and service_role keys are rejected everywhere through `shared/supabase/keys.ts`.
- The browser gets only `VITE_*` values: the Supabase URL, the publishable key, the Maps key and the guest login. `GEMINI_API_KEY` and `GOOGLE_ROUTES_KEY` are Edge Function secrets.
- The app and README support exactly one `GEMINI_API_KEY`.
- `.env`, `.env.local` and `API_Key_Configuration.md` hold live credentials and are gitignored.

## Product rules that shape code

These come from `PRODUCT.md` and the PRD. Both are gitignored, local-only files. The source of truth is `docs/superpowers/specs/2026-11-05-campusspotter-prd.md`; where they differ, §13 of `…-design.md` overrides it.

- Every figure carries a provenance label: Verified, Baseline or AI-estimated. Missing data shows "not enough data" or "no service" and is never replaced by a guessed value.
- Moving classes online always shows a learning-disruption figure. Over-budget plans are marked and never recommended. Gemini's reasoning is shown apart from the computed effects.
- Pressure (Normal / Busy / Overloaded) is always shown as colour, icon and word together. Provenance colours stay distinct from pressure colours. The UI uses a dark theme only.
- Formats: 12-hour times ("6:45 PM"), "RM 1,300", "1 h 20 min", Malaysia time (MYT), English only. Use the helpers in `shared/engine/format.ts` and `src/lib/format.ts`.
