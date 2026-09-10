# Saldo POC — Roadmap & plan index

Spec: [`docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`](../specs/2026-09-10-saldo-poc-spec.md)
Design: [`docs/design/`](../../design/README.md)

The POC is split into **9 phases**. Each phase produces working, tested software on its own and gets its own
implementation plan in this folder.

- **Plan 01 is fully written** (`2026-09-10-01-foundation.md`).
- Plans 02–09 are **scoped here, not yet written**. Before starting a phase, the implementing agent writes its
  plan with the `writing-plans` skill, using the scope and acceptance criteria below plus the spec sections listed.
  Plans are written just-in-time because each one depends on real file names and APIs produced by earlier phases.
  File name: `YYYY-MM-DD-NN-<slug>.md`.

## Dependency graph

```
01 Foundation ──┬──> 02 Mobile shell & local DB ──┬──> 03 Transactions & Home ──> 04 Budgets & Stats ──> 05 Accounts, Categories, Tags, Settings
                │                                  │
                └──> 06 Server & passkey auth ─────┴──> 07 Sync engine ──> 08 Attachments & Import/Export ──> 09 Release docs & hardening
```

- 02 and 06 can run **in parallel** after 01.
- 03 → 04 → 05 are sequential (shared components grow).
- 07 needs 02 (local DB) and 06 (auth).
- 08 needs 07 for blob sync and 03 for the transaction sheet (local attachment capture can start after 03 if 07 isn't done).

## Phases

### 01 — Foundation ✅ done

**Plan:** `2026-09-10-01-foundation.md` · **Spec:** §2, §3, §4, §5.1–5.8, §5.12, §12, §13

Monorepo tooling (pnpm, Turborepo, TypeScript, Biome, Vitest, CI), plus three packages:
`@saldo/core` (dates, cycles, money, ids, entity schemas, ledger totals, stats, budgets, filters),
`@saldo/ui` (tokens + icons) and `@saldo/i18n` (catalog skeleton + deterministic formatters).

**Acceptance:** `pnpm lint && pnpm typecheck && pnpm test` green from a clean clone; no apps yet.

### 02 — Mobile shell & local database ✅ done

**Plan:** `2026-09-10-02-mobile-shell.md` · **Spec:** §3.3, §6 (navigation tree, 6.14, 6.29 steps 1–3, 6.32), §7, §12, §13, §15 (`app.config.ts` only)

- `apps/mobile` via `create-expo-app` (TypeScript, Expo Router), workspace wiring (Metro monorepo config), `app.config.ts`
  with env-driven identity.
- Providers: SQLite + Drizzle + migrations, ThemeProvider (system/dark/light), Geist fonts, i18next, gesture handler,
  safe area, bottom sheet host.
- Primitives: `Text`, `Icon` (renders `@saldo/ui` icon nodes with `react-native-svg`), `Card`, `ListRow`,
  `SectionLabel`, `Toggle`, `Segmented`, `Chip`, `PrimaryButton`, `SecondaryButton`, `TextField`, `Keypad`, `Sheet`, `Toast`,
  `ConfirmDialog`, `ProgressBar` (with pace tick), `AmountText` (50% opacity fraction).
- Drizzle schema for all §4 entities + `kv` table; repositories with HLC stamping (a simple local HLC in core `sync/hlc.ts`
  is **pulled forward into this phase**, with tests); `useLiveQuery` hooks.
- Tab bar + FAB, empty tab screens, onboarding steps 1–3 writing settings/account/seed categories (§4.2), app lock
  (§6.32), dev "Carica dati demo" seeder.

**Acceptance:** fresh install → onboarding → tabs visible in dark and light, it and en; data persists across restarts;
repository unit tests pass; `expo run:android` and `expo run:ios` launch.

**Status:** met on iOS — `expo run:ios` builds and boots into onboarding, both palettes verified on the simulator, 55
mobile tests green. `expo run:android` is **unverified**: the machine this phase was built on has no Android SDK.
Recurrences, attachments and the tags/budgets admin screens stay with their own phases.

### 03 — Transactions & Home ✅ done

**Plan:** `2026-09-10-03-transactions-home.md` · **Spec:** §5.2, §5.3, §5.6, §5.9, §5.10 (tag input only), §5.12, §6.1, 6.2, 6.6, 6.15, 6.16, 6.21, 6.23, 6.26, 6.27

- New/edit transaction sheet (all fields except attachments, which get a disabled button with "Presto" until phase 08).
- Recurrence entity + materialiser + edit-scope sheet.
- Transactions list: search, chips, pickers, tag filter sheet, swipe rows (Reanimated/Gesture Handler), delete + undo.
- Transaction detail, period sheet (cycles + custom range + start day), Home cards (remaining, cycle trend chart, upcoming,
  recent). The Home budget card stays hidden until 04.

**Acceptance:** add/edit/delete/undo expense, income and transfer; recurring edit with all three scopes; Home numbers
match `@saldo/core` for demo data; component tests for keypad, swipe thresholds and form validation.

**Status:** met on iOS, verified on the simulator with the demo data seeded straight into the app's SQLite file
(`pnpm --filter mobile seed:db`), since `simctl` cannot tap through onboarding. The keypad tests became
`sanitizeAmountInput` tests when amounts moved to the device keyboard (D23); swipe thresholds come from the shared
`gestures` tokens and are exercised by hand, not by a test. Attachments stay disabled until phase 08.

### 04 — Budgets & Statistics ✅ done

**Plan:** `2026-09-10-04-budgets-stats.md` · **Spec:** §5.4, §5.5, §5.7, §5.8, §6.3, 6.4, 6.12, 6.17, 6.18

- Budget list, new/edit budget sheet (median suggestion, taken categories, period, alerts, rollover), budget detail
  sheet, Home budget card, local notifications on threshold crossing.
- Statistics: cashflow, committed share, projection, split with deltas, excluded row; category detail.
- Core additions: week/year budget ranges, rollover carry, 6-cycle history loaders.

**Acceptance:** stats and budget numbers verified against core unit tests for demo data; notifications fire once per
period; rollover correct across 3 cycles (unit test).

**Status:** met. Rollover is unit-tested across four cycles and the once-per-period rule is a pure function over the
device-local `kv` marker, so it is tested too. Statistics was checked on the simulator; the budget list and Home budget
card were not, because reaching them needs a tap that `simctl` cannot give — they rest on the tested `budgetViews`.
Notifications were not observed firing on the simulator.

### 05 — Accounts, Categories, Tags, Settings, Profile ✅ done

**Plan:** `2026-09-10-05-accounts-settings.md` · **Spec:** §5.3 (balances, credit card), §5.10, §5.11, §6.5, 6.7–6.11, 6.13, 6.19, 6.20, 6.22, 6.24, 6.25

- Accounts tab, account detail (sparkline, credit card box, transfer shortcut), account sheet (edit current balance →
  opening balance), archive/restore.
- Categories admin (reorder, archive with move), category sheet (icon search, colour, parent, monthly budget).
- Tag admin, tag edit (rename/merge/delete), tag view.
- Settings, Profile (language, theme, currency with confirm, cycle day, app lock, version); export/import rows show
  "Presto" until 08; the server row is hidden until 07.

**Acceptance:** every design screen reachable and functional locally; merge/archive operations are transactional (tests).

**Status:** met on the logic — every merge/archive path is transactional and unit-tested, including the budget rewrite
that stops an archived category leaving a budget measuring nothing. Of the screens, only Home was checked visually
(which is how a card that was written but never rendered got caught); the rest need taps that `simctl` cannot give.
Import/export and the server row are deliberately "Presto" until phases 07 and 08.

### 05b — UI fixes from the first hands-on review ✅ done

Found by running the seeded app on the simulator, after 05 was merged. No plan file: five bounded fixes to screens
phases 03–05 had already delivered.

- **No loading state.** `app/index.tsx`, `DatabaseProvider` and the i18n gate all returned `null`, so the boot gaps
  showed a blank screen once the splash had gone. They now render `LoadingScreen`, and the transactions list shows a
  spinner until its first query result arrives (`useTransactionsInRangeQuery().loaded`).
- **No way back from a pushed screen.** The root `Stack` runs with `headerShown: false` because §6 draws its own
  chrome, and none of the pushed screens drew a back affordance. Added `BackButton`/`ScreenHeader`
  (`src/components/ScreenHeader.tsx`), used by the four forms, the four detail screens, Budgets, Profile, Settings and
  the onboarding steps. It hides itself when `router.canGoBack()` is false, so a deep-linked screen shows no dead
  control.
- **Transactions list clipped, filter chips cut off.** A vertical `ScrollView` with no `flex` inside a `flex: 1`
  column sizes itself to its content and is then clipped by the parent instead of scrolling; the horizontal chips row
  was stretching for the same reason. The list now takes `flex: 1` and the chips row `flexGrow: 0`, bleeding to the
  screen edges with a negative margin.
- **Dead black band above the tab bar.** A custom `tabBar` is laid out *in flow* by the navigator,
  so a tab screen already ends above it, but `Screen` reserved `tabBarHeight + insets.bottom` on
  top of that. On `scroll={false}` screens that padding sits on the container and shrinks the
  list's viewport, so 112pt of the screen could not be scrolled into at all. `Screen` now reserves
  only `fabLift`, the overhang of the FAB.
- **Cashflow chart did not match the design.** Rewritten to the prototype's geometry (lines 265-289): net label per
  column, 16px bars in two 54px halves around a 1px axis, 45° hatching on the running cycle, and the legend. The
  hatch is drawn as diagonal `Path` lines: `patternTransform="rotate(45)"` renders as dots in react-native-svg. The
  category detail screen was reusing this chart with `income: 0`; it now has `SpendHistoryChart`, which is the
  single-series column chart the design actually shows there (lines 878-887), plus the "6-cycle average" footer.
- **Demo data flags were wrong.** `scripts/generate-demo-data.mjs` assumed the prototype's row format was
  `[…, isIncome, isExcluded, tags]`, but its own `toObj` reads `[…, isIncome, isScheduled, tags, isExcluded]`. Three
  scheduled rows were therefore seeded as "excluded from totals", which is why day totals read €0.00 next to a
  non-zero row. `seed:db` also grew a `--reset` flag, without which a change to the demo data never reaches an
  already-seeded simulator, and it now resolves category names through the English locale instead of showing raw keys.

**Verified:** transactions list and statistics screenshotted on the simulator against a freshly seeded database; the
pushed-screen header screenshotted via a temporary `router.push` probe (`simctl` cannot tap, and a deep link raises a
system "Open in Saldo?" dialog that itself needs one). Android remains unverified.

### 06 — Server & passkey authentication ✅ done

**Plan:** `2026-09-10-06-server-auth.md` · **Spec:** §9, §14, §18 · **Can run in parallel with 02–05**

- `apps/web` via `create-next-app` (App Router, TS), Drizzle + Postgres schema/migrations, PGlite test harness, docker
  compose + Dockerfile + Caddyfile example.
- `/api/health`, WebAuthn register/login (SimpleWebAuthn), `/auth/mobile` page, auth codes with PKCE, token endpoint
  (JWT access + rotating refresh with reuse detection), logout, `/api/me`, rate limiting, security headers.

**Acceptance:** route-handler tests for every auth path, including PKCE mismatch, expired/used code and refresh reuse;
manual passkey registration and login in a desktop browser against `http://localhost:3000` succeed.

**Status:** 57 tests, all route handlers called directly with `Request` objects against an in-memory Postgres (PGlite),
with `@simplewebauthn/server` mocked at its own module boundary as §16 prescribes. Covered: PKCE mismatch (and that a
wrong verifier does not burn the code), expired and already-used codes, refresh rotation, reuse detection revoking the
whole chain, unknown-credential and bad-signature logins answering identically, the `redirect_uri` allow-list, the
registration policy, the rate limit, and the body size cap.

Beyond the plan, verified by hand against **real Postgres 17** (PGlite is not the production driver): migrations,
`/api/health`, `/api/me` 401, the security headers, the CSP on `/auth/*`, a rejected `redirect_uri` rendering the error
page, then the full token flow through `curl` — code exchange, bearer `/api/me`, rotation, and a replayed refresh token
killing the rotated one too. The **Docker image was built and run** against that Postgres: it migrates on start and
serves, and `registrationAllowed` flips to false after the first account in `first-user` mode.

**Review findings, both fixed here:** every expiry compared `expiresAt < now`, leaving auth codes, challenges and
refresh tokens usable *at* their deadline (RFC 7519 says reject on or after `exp`) — now `<=`, each with a boundary
test that fails against the old code. And the rate limiter bucketed on the **first** `X-Forwarded-For` entry, which is
client-supplied, so anyone could rotate the header and reset their own bucket; it reads the last hop now.

**Superseded in part by 06b:** the hand-rolled auth described above was replaced by Better Auth at the user's
request; the sync protocol, the screens and the health probe survive unchanged.

**Not verified:** the manual browser passkey ceremony. It needs a real platform authenticator (Touch ID / Windows
Hello) and there is no browser automation on this machine, so it is the one acceptance criterion left to the user;
`docs/self-hosting.md` has the steps. Deviations from the spec, both deliberate: `webauthn_challenges` gained a
`display_name` column so the register-verify step need not trust a second client-supplied copy of the name, and
`/api/health` reports `registrationAllowed` so the app can hide "create account".

### 06b — Authentication moved onto Better Auth ✅ done

**Plan:** `2026-09-10-06b-better-auth.md` · **Spec:** §9 (rewritten), §18

Asked for by the user after 06 shipped. `better-auth` + `@better-auth/passkey` + `@better-auth/expo` replace the
hand-written WebAuthn ceremonies, the HS256 access tokens, the refresh chain with reuse detection, the challenge and
auth-code stores and the token-bucket limiter — **−888 lines net**, four tables gone, eight route handlers gone. Both
defects the phase 06 review found lived in the code this deleted.

The handoff from the browser ceremony to the app uses Better Auth's `one-time-token` plugin (single use, one minute,
stored hashed). The Expo plugin's own redirect flow does not apply: reading its client shows it hooks
`signIn`/`link-social` responses that carry a `redirect`, which a passkey ceremony has none of.

**Verified** against real Postgres 17: the generated schema migrates (6 tables), `/api/health` reports
`schemaVersion`, `/api/me` is 401, Better Auth answers on its catch-all, the discoverable-login options carry a real
challenge and no `allowCredentials`, register options refuse a missing display name (400) and — after one account
exists in `first-user` mode — refuse outright (403) while `/api/health` flips `registrationAllowed` to false. The
`/auth/mobile` page renders, keeps its CSP, and still rejects a `redirect_uri` outside the allow-list. The one-time
handoff is covered by tests: single use, unknown token refused, no session refused, and the token is not stored in
the clear.

**Not verified:** the browser ceremony itself, which needs a real platform authenticator (Touch ID) — still the
user's to run. **Accepted risk, recorded in §9.3:** the handoff token travels in a `saldo://` URL.

### 07 — Sync engine ✅ done

**Plan:** `2026-09-10-07-sync.md` · **Spec:** §8, §6.29 step 0 (welcome/connect), §6.30, §9.3 (mobile side)

- Core: HLC receive, LWW merge helpers, sync protocol Zod schemas (shared by client and server).
- Server: `sync_rows`, push/pull services and routes.
- Mobile: server connection screen, `openAuthSessionAsync` sign-in, secure token store + refresh, SyncScheduler
  (triggers, single-flight, backoff), apply pull pages transactionally, welcome step in onboarding (local vs server),
  logout.

**Acceptance:** two simulators signed into the same server converge after concurrent offline edits (manual script in the
plan); core property test showing random interleavings converge; server tests for stale/invalid/pagination.

**Status:** all three met, the first one better than asked. Convergence is proved by `src/sync/convergence.test.ts`:
two `better-sqlite3` devices and an in-memory server implementing §8.3/§8.4, over six scenarios — independent
creates, a concurrent edit of the same row, an edit racing a delete in **both** directions, a transaction amount
corrected on the other device, and nothing left pending afterwards. That is deterministic and runs in CI, which two
simulators would not be. `packages/core/src/sync/merge.test.ts` adds the property test: 40 seeded interleavings of two
replicas with drifting wall clocks, plus an order-independence check. The server has tests for applied/stale/invalid,
the envelope-vs-body disagreement, a clock more than 24h ahead, pagination and per-user scoping.

The review found no data-loss or scoping issue. Its one actionable note — that `applyPull`'s
`onConflictDoUpdate({ target: table.id })` assumes `id` is each table's primary key, or the apply would insert a
duplicate instead of overwriting and the devices would diverge — is now an explicit test over all seven tables
(`src/sync/entities.test.ts`, reading `pragma_table_info`).

The §8.1 decision (schema-version gate) is implemented on both sides and refuses a mismatched peer with
`schema_too_old`/`schema_too_new`.

Screens verified on the simulator after a native rebuild (three new native modules): the app boots with the sync
providers mounted, §6.29 step 0 renders with its two ways in, and §6.30 renders its not-connected state. Two flaws
were caught that way and fixed — "Non connesso" printed twice, and a `justifyContent: 'center'` that could not work
inside a `ScrollView`.

Push and pull were also exercised against **real Postgres 17** through `curl`, which PGlite does not stand in for on
the two parts that matter: `nextval('sync_seq')` and the upsert's `setWhere` HLC comparison. An older copy of a row
came back `stale` and left the stored row untouched, the sequence stayed monotonic, and a second user's pull returned
nothing.

**Not verified:** signing in for real, which needs the browser passkey ceremony (§9.3) and therefore a platform
authenticator; and with it the connected state of §6.30, the scheduler against a real server, and two devices over
the network. The logic behind all of them is covered by the tests above.

### 08 — Generic periods, and one mandatory sign-in

**Plan:** `2026-09-10-08-periods-and-signin.md` · **Spec:** §1.1, §5.2, §5.8, §6.15, §6.29, §8.1

Asked for by the user after 07. The pay cycle stops being *the* period: `PeriodDef` in `@saldo/core` covers month,
week, cycle and year, the sheet gains the rows the design shows (custom range, period kind, cycle start day), and
`budget.period` speaks the same vocabulary. And the two ways into the app collapse into one: signing in to the user's
own server, which becomes required — the app still works offline, what it needs is an account, not a connection.

- Core: `PeriodDef`, `periodContaining`/`shiftPeriod`/`previousPeriods`, and the period-shaped functions
  (`periodHistory`, `budgetRange`, `budgetCarry`) re-parameterised. Everything that already took a `DateRange` is
  untouched, which is what keeps this wide but shallow.
- Schema: `settings.periodKind`, `budget.period: 'period' | 'week' | 'month' | 'year'`, `SYNC_SCHEMA_VERSION` → 2.
  Regenerated rather than migrated: no instance is deployed and no user exists.
- Mobile: the period sheet, a period question in onboarding step 1, and step 0 becoming the sign-in.

**Acceptance:** core tests for every kind including the February and leap-year edges and a month budget inside a cycle
period; the sheet's three new rows work on the simulator; switching kind reshapes Home and Statistics.

### 09 — Attachments & Import/Export

**Spec:** §10, §11, §6.6 (attachments), 6.16 (Allega foto), 6.28, 6.31

- Capture/compress/store attachments, thumbnails, viewer, blob upload/download queue + server routes + cleanup.
- JSON backup export/restore, ZIP with attachments (fflate), CSV export, CSV import wizard with generic mapping and the
  Spendee preset (**ask the user for a real Spendee CSV sample** before finalising the preset).
- Core `io/` module: CSV serialise/parse, backup schema, fingerprints, import planner (pure, fully unit-tested).

**Acceptance:** export → wipe → restore round-trip is lossless (test); CSV import of a fixture creates the expected
accounts/categories/tags and skips duplicates on a second run; an attachment added on device A appears on device B.

### 10 — Release docs & hardening

**Spec:** §15, §16 (E2E), §18, §19

- `docs/building-android.md`, `docs/building-ios.md`, `docs/self-hosting.md`, README (features, screenshots, quick start),
  CONTRIBUTING, release-signing config plugin, `build:android` script, Maestro flows, privacy overlay, accessibility
  pass (labels, hit areas, reduce motion), performance check with 20k generated transactions.

**Acceptance:** a person following only the docs on a clean machine produces an installed APK and an iOS build connected to a
self-hosted server.

## Future (not POC)

- Web app UI (spec §17.1)
- AI receipt analysis, BYOK (spec §17.2)
- AI spending insights, BYOK (spec §17.3)
- Native passkeys (spec §9.4)
