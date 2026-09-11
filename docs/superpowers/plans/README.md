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
- Schema: `settings.periodKind`, `budget.period: 'period' | 'week' | 'month' | 'year'`. Regenerated rather than
  migrated, and `SYNC_SCHEMA_VERSION` stays 1: no instance is deployed and no account exists, so there is no older
  peer for the §8.1 gate to protect.
- Mobile: the period sheet, a period question in onboarding step 1, and step 0 becoming the sign-in.

**Acceptance:** core tests for every kind including the February and leap-year edges and a month budget inside a cycle
period; the sheet's three new rows work on the simulator; switching kind reshapes Home and Statistics.

**Status:** met. `packages/core/src/period.test.ts` covers all four kinds, the leap-February month end, a Sunday
belonging to the week that started six days earlier, the pay cycle's per-month clamping, reversibility of every
`shiftPeriod`, and closed versus current periods; `budgetRanges.test.ts` adds a month budget inside a pay cycle and
the rule that an annual budget browsed from a past month still measures the whole year.

Verified on the simulator against a reseeded database: the period sheet shows the three rows the design has —
custom period, period type, and the cycle start day under the cycle kind — and with `periodKind = 'week'` the header
reads "Sep 7 – Sep 13, day 4 of 7" (the ISO week containing today) with the list filtered to it, which exercises the
whole chain from settings through the provider to the screens.

Two defects were found that way and fixed: the sheet was missing the cycle-start-day row the spec had just described,
and the welcome copy still promised the app stays on this phone unless a server is connected — the opposite of what
it now does. A third thing worth recording: after regenerating the migrations, Metro served a **cached** copy of the
inlined `.sql`, so the app applied the old schema and the seeder failed on the missing column. `expo start --clear`
plus deleting the simulator's database file is the fix.

**Review finding, fixed:** reading the stored session caught a thrown network failure as `{ data: null, error: null }`,
which the next branch read as "the server rejected this session" — so opening the app with no network signed the user
out of their own offline data, the exact opposite of the comment two lines above it. The decision now lives in
`src/auth/sessionState.ts` as a pure function with tests, because it decides whether someone gets locked out: only an
answer *with no session and no error* signs out; no answer at all, or an answer carrying an error, keeps the cached
session.

**Not verified:** signing in for real (the passkey ceremony needs a platform authenticator), so the screenshots above
were taken with the sign-in gate bypassed by a temporary probe that was then reverted.

### 08b — The server comes from the build, not from the user ✅

Asked for by the user after 08: "durante sign in non serve chiedere server, l'app sarà buildata con l'env verso il
server corretto."

- `SALDO_SERVER_URL` joins the §15 build env table and reaches the app through `app.config.ts` → `extra` →
  `expo-constants`. Validated with the existing `normaliseServerUrl`; a build without a usable value says so plainly,
  because sign-in is required and the app cannot work without one.
- `ConnectForm` loses its URL field and its "Verifica" button: it checks `/api/health` on mount to learn
  `registrationAllowed`, then offers "Accedi con passkey" and, when allowed, "Crea account". Onboarding step 0 becomes
  one screen with one or two buttons.
- `ServerProvider` reads the URL from the build instead of `kv`, so `kv.serverUrl` goes away and signing out no longer
  has to forget an address. Token-store keys stay scoped by URL, which still matters if a later build points
  somewhere else.
- §6.30 shows the configured address as read-only text.
- Spec: §9.3 step 1, §6.29 step 0, §6.30, §15.

**Done** (plan: `2026-09-11-08b-server-from-build-env.md`). `SALDO_SERVER_URL` → `extra.serverUrl` → `readServerUrl`;
`ConnectForm` probes `/api/health` on mount and offers sign-in without a field; `kv.serverUrl` is gone.

### 09 — Attachments & Import/Export

**Spec:** §10, §11, §6.6 (attachments), 6.16 (Allega foto), 6.28, 6.31

Split into three, and reordered at the user's request — export first, because the Spendee CSV sample the import
preset needs has not arrived yet ("sto aspettando che mi arrivi un export, parti dalla feature di export").

**09a — Export & restore** ✅ (plan: `2026-09-11-09a-export-and-restore.md`). Core `io/`: backup schema, CSV serialise, both pure and fully unit-tested. Mobile: JSON
backup export, CSV export (current period or everything), restore with validation and the "replaces everything on
this phone" confirmation, sharing through `expo-sharing`. No attachments yet: the ZIP variant waits for 09b.
*Acceptance:* export → wipe → restore round-trip is lossless (test); the CSV opens in a spreadsheet with the columns
of §11.2.

**09c — CSV import** ✅ (plan: `2026-09-11-09c-csv-import.md`). Wizard with generic mapping, duplicate fingerprints, import planner (pure), and the Spendee
preset. **Unblocked:** the user supplied a real export on 2026-09-11; the format is written up in §11.3 and the
anonymised fixture is `packages/core/src/io/__fixtures__/spendee.csv`.

**09b — Attachments.** Discussed and settled on 2026-09-11: **where the blobs live is the server's business**, not
the app's, so `apps/web` owns an `AttachmentStore` interface with `fs`, `s3` (configurable endpoint, so R2/MinIO/
Backblaze come for free), `vercel-blob` and `none`. Presigned uploads are required, not optional: a serverless
request body caps at ~4.5 MB against a 10 MB attachment. `ATTACHMENT_STORAGE=none` is supported and is the default —
attachments stay on the phone, the row still syncs, and `/api/health` says so. Big enough to run in three parts:

- **09b-1 — Server storage** ✅. The interface, the four drivers, the env, `attachmentsEnabled` in `/api/health`, and
  the upload-intent / direct / complete / download routes.
- **09b-2 — On the phone** ✅. Capture, compress (≤2000px, JPEG 0.8, EXIF stripped), the local file store, the
  attachments table with its device-local `blobState`, thumbnails, the viewer (§6.28) and the transaction form rows.
- **09b-3 — Blob sync, cleanup and the ZIP backup** ✅. The upload queue (only after the row has been pushed) and
  on-demand download; the server-side deletion queue for tombstoned blobs (a scan on every push would re-delete
  every blob ever deleted, since tombstones are forever); the `fflate` backup that carries the files, which 09a left
  for this phase, and a restore that reads it back.

*Acceptance:* an attachment added on device A appears on device B; with `ATTACHMENT_STORAGE=none` the same
attachment stays local and the app says so rather than failing. **Not verified end to end**: no test uploads to a
real bucket, and the two-device journey needs two devices — what is covered is every decision either side makes
(`blobSync`, the routes, the cleanup queue) against a real filesystem store.
*Acceptance:* importing a fixture creates the expected accounts/categories/tags and skips duplicates on a second run.

### 10 — Access control: who is allowed in 🔜 queued

Asked for by the user: "dare la possibilità di scegliere chi può accedere all'app per non avere malintenzionati."

Today `REGISTRATION` (§9.2) is all-or-nothing: `open`, `first-user`, or `closed`. Once it is closed the owner cannot
let a second person in without redeploying, and while it is open anyone who can reach the server can create an
account. Accounts are passkey-only and carry no email, so the natural mechanism is an **invite**:

- The owner mints a single-use invite (an admin page or a CLI on `apps/web`), with a TTL and an optional label.
- "Crea account" asks for the invite code; the server validates and burns it inside the same ceremony that creates
  the user, so a failed registration does not consume it.
- The owner can list accounts and revoke one; deleting a user cascades to their `sync_rows` (the foreign key already
  does this).
- `REGISTRATION` gains `invite` alongside the three existing values, and `/api/health` keeps reporting whether
  registration is possible so the app knows whether to offer the button at all.

**Acceptance:** an invite works exactly once; an expired or unknown code is refused without telling the caller which;
a revoked user's bearer stops working and their rows stop syncing; the whole flow has route-handler tests.

### 11 — Release docs & hardening

**Spec:** §15, §16 (E2E), §18, §19

- `docs/building-android.md`, `docs/building-ios.md`, `docs/self-hosting.md`, README (features, screenshots, quick start),
  CONTRIBUTING, release-signing config plugin, `build:android` script, Maestro flows, privacy overlay, accessibility
  pass (labels, hit areas, reduce motion), performance check with 20k generated transactions.

**Acceptance:** a person following only the docs on a clean machine produces an installed APK and an iOS build connected to a
self-hosted server.

### UI scoping — motion, the transaction form, date entry 🔜 queued

Asked for by the user on 2026-09-11. Three **investigations**, not implementations: each ends in a
decision and a short scope, and the work that follows gets its own plan. Written up in
`2026-09-11-ui-scoping.md`.

- **A. Motion.** The app has no motion of its own — §13 covers colour, type and radii and says
  nothing about timing. Decide where animation carries meaning, one timing scale as `@saldo/ui`
  tokens, the library, and the reduced-motion rule.
- **B. The transaction form (§6.16).** The screen the app exists for, assembled row by row across
  phases and never looked at whole. Decide the fast path, the field order, what a disclosure hides,
  and the "recently used" rule — as a core function, not screen logic.
- **C. Date entry.** Every transaction has a date and the design draws a calendar the app does not
  have. Decide native picker versus drawn calendar (and say why, because it will not be revisited
  cheaply), the today/yesterday shortcuts, and how `CustomRangeSheet` reuses the same component.

Order, if done in order: C, then B, then A — date entry lives inside the form, and motion is worth
scoping once the screens it animates have stopped moving. None of them blocks 10 or 11.

## Future (not POC)

- Web app UI (spec §17.1)
- AI receipt analysis, BYOK (spec §17.2)
- AI spending insights, BYOK (spec §17.3)
- Native passkeys (spec §9.4)
