# Saldo POC — Roadmap & plan index

Spec: [`docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`](../specs/2026-09-10-saldo-poc-spec.md)
Design: the prototype in `docs/design/` (not part of the repository; the spec and `@saldo/ui` carry its values)

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

**Verified on a phone, 2026-10-19:** the passkey ceremony works on a real phone, through the app's sign-in. A run in a
desktop browser is not recorded. Deviations from the spec, both deliberate: `webauthn_challenges` gained a
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

**Verified on a phone, 2026-10-19:** the passkey ceremony works on a real phone. **Accepted risk, recorded in §9.3:** the handoff token travels in a `saldo://` URL.

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

**Verified on a phone, 2026-10-19:** signing in for real works. **Not recorded:** the connected state of §6.30, the
scheduler against a real server, and two devices over the network. The logic behind all of them is covered by the
tests above.

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

The screenshots above were taken with the sign-in gate bypassed by a temporary probe that was then reverted. Signing
in for real works on a phone (2026-10-19).

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

**Reversed 2026-09-25** by `2026-09-25-local-first.md`: the app starts without a server, the address is typed again
(`kv.serverUrl`, written by a successful sign-in), and `SALDO_SERVER_URL` is gone from the build.

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

### 10 — Access control: who is allowed in ✅ done

**Plan:** `2026-09-11-10-access-control.md` · **Spec:** §9.2, §9.5

Asked for by the user: "dare la possibilità di scegliere chi può accedere all'app per non avere malintenzionati."

`REGISTRATION` gains `invite`, under which **no account exists without a single-use code — the first
one included**. That first code is minted by a CLI on the server, which is what makes the owner the
owner rather than whoever reached the URL first; `first-user` left the door open until somebody
walked through it. Roles and revocation are Better Auth's `admin` plugin (the same "let the library
do auth" decision as 06b); the invites are ours — sha-256 of a 16-symbol Crockford code, checked in
`resolveUser` before the WebAuthn ceremony starts and burned in `afterVerification` by a conditional
`UPDATE`, with the burn released if writing the account then fails.

The app grew **no screen** this phase, by the user's decision: the code is typed into `/auth/mobile`,
which the server serves, so `apps/mobile` is untouched. Minting from the app is a later, thin layer
over routes that already exist and are tested.

**Acceptance:** all four met.
- *An invite works exactly once* — `invites.test.ts`, including two burns racing under `Promise.all`,
  of which exactly one returns an id.
- *An expired or unknown code is refused without telling the caller which* — unknown, spent, revoked
  and expired share one predicate and one `invalid_invite` answer; `registrationGate.test.ts` asserts
  the four errors are byte-identical by comparing them as an array.
- *A revoked user's bearer stops working and their rows stop syncing* — `app/api/access.test.ts`.
  Two writes are needed and both are tested: Better Auth's ban check only runs when a session is
  **created**, so `revokeUser` also deletes the session rows and `requireUser` re-reads the flag on
  every authenticated request.
- *Route-handler tests for the whole flow* — `app/api/invites/invites.test.ts` covers mint, list and
  revoke, each with its 401 and its 403.

**Verified beyond the tests**, against the real Postgres 17 dev stack and over HTTP, because PGlite
does not stand in for the `pg` driver the registration hooks and the CLI actually use: migrations
apply; `/api/health` reports `inviteRequired:true`; `/auth/mobile?mode=register` renders the code
field and the login mode does not; an unknown code and a revoked code both answer 403
`invalid_invite`; a **valid** code returns real registration options **and is still `active`
afterwards**, which is the abandoned-ceremony invariant; and the CLI walks
`invite new --label … --days 3` → `list` (`active`) → `revoke` → `list` (`revoked`), plus
`user list`. Flags reach the scripts without a `--` separator.

**Verified on a phone, 2026-10-19:** the passkey ceremony runs end to end. **Not recorded separately:** the burn of an
invite in `afterVerification`, the release on failure and the first-account-becomes-admin rule. Those paths rest on
the unit tests for `burnInvite`, `releaseInvite` and `roleForNewUser`.

**Review findings, both fixed here.** The first-account-is-the-admin rule was a read-then-write:
two ceremonies finishing together both saw an empty `user` table and both became admin. Moving the
count after the insert would have been worse — both would have seen two rows and **neither** would
have become the owner — so the claim now runs under an advisory lock and asks "is the earliest
account mine", an answer that does not depend on when it is asked. And Better Auth's `admin` plugin
serves its own endpoints from the `/api/auth` catch-all, which nothing tested: an anonymous caller,
a member and a revoked admin are all refused `admin/list-users` and `admin/create-user`, and that is
pinned by `app/api/auth/adminPlugin.test.ts`.

**Upgrade note:** an account created before this phase has `role = NULL` and is therefore not an
admin. `pnpm --filter web user promote <id>` is the one-off fix, and it is in `docs/self-hosting.md`.
The same rule is why a newly invited member does not inherit such an instance: they are not its
earliest account.

### 10b — Whose data is on this phone 🩹 stopgap

Found by the user while testing phase 10: creating a second account on a phone that already holds
data shows the first account's transactions — and pushes the ones still `PENDING` into the second
account's rows. Nothing on the device records who wrote a row (`pendingChanges` selects on
`sync_state` alone), so there is no way to show two accounts apart.

`kv.accountId` now records which account the rows belong to, written at sign-in and wiped with
everything else by a reset. `ownershipVerdict` compares it with the account signing in, and the two
cases that need no question — a device that has never recorded one, and a device with no rows —
answer `keep`. A different account on a phone that holds rows asks before it proceeds, saying how
many changes were never sent, and signs straight back out if the answer is no. The check runs
**before** the session is installed, because `SyncProvider` starts a cycle the moment a user
appears.

**This is a stopgap and is labelled one.** The proper fix is scoping the local rows, and the
decision recorded on 2026-09-12 is not to write it yet: what the rows would be scoped *by* is not
the account. Sharing data between people needs an owning entity on the server — `sync_rows` is
keyed `(user_id, entity, id)` and the pull is `where user_id = ?` — and that entity, not the
account, is what the phone would key on. Scoping by account now is work to redo under another name.

The two shapes sharing could take, kept here so the choice is not re-derived:
- **Two people, one account.** Each registers a passkey on the same user. The server already works
  this way; what is missing is a way to add a passkey to an existing account, since `resolveUser`
  always mints a new user and `addPasskey` wants a session. Needs no local scoping at all.
- **Two accounts, shared data.** An owning entity (household, space), a membership table, the pull
  scoped to the spaces a user belongs to, and a rule for what happens to rows when somebody leaves.
  The LWW merge already tolerates more writers.

### 11 — Release docs & hardening ◐ built, awaiting the hardware half

**Plan:** `2026-09-13-11-release-and-hardening.md` · **Spec:** §15, §16 (E2E), §18, §19

**Done and verifiable without a device.** The repository is green again — `pnpm lint` was failing on 26 accessibility
errors in the icon generators, so CI was red and every later check in the phase would have been unreadable. The two
§18 items that had never been built now exist: the CSV export prefixes the formula characters (and `csvParse` strips
the prefix back off, so a re-import is lossless), and a privacy overlay covers the app switcher snapshot — in the root
tree *and* in the two modal routes, because those are their own native windows and the transaction form is the screen
with an amount on it. The accessibility sweep covered every tappable control in 76 files; the two worst finds were an
`AmountInput` wrapper that swallowed the amount field entirely from VoiceOver, and a transaction row with no role, no
name and two drag actions unreachable without them. §19.4 is answered with numbers rather than an opinion.

**§19.4, answered.** 20k transactions is comfortable in memory: the heaviest screen spends **4.7ms** folding, against
a ~100ms budget. `monthEndBalances` dominates (5.2ms at 20k, 43.4ms at 50k) because it walks the whole ledger once per
sparkline point. Nothing moves into SQL. Read the table in `docs/self-hosting.md` as a floor: it is Node on a
development Mac with no database and no rendering in the way, not Hermes on a phone.

**`build:android` works end to end, proved by running it.** Three defects had to be fixed first, all found by
following the new documents rather than by reading them: `babel-preset-expo` was named in `babel.config.js` but only
installed transitively, `lintVitalRelease` failed on iOS permission strings that the `locales` block had leaked into
Android resources, and the signing plugin made a keyless `assembleRelease` impossible — the opposite of what its own
comment promised. `./gradlew :app:signingReport` had made that last one look fine; a report is not a build.

**Security audit against §18: no Critical.** Every route authenticates, validates with Zod and scopes by user. Three
Important findings were fixed here — body limits that measured after buffering (and one route with no limit at all),
auth rate limiting that collapsed into a single shared bucket behind the Caddy config this repo ships, and an
unconfigured session lifetime. **Three §18 lines were stale rather than unmet** and now describe what shipped: there
is no refresh token to rotate, no PKCE (phase 06b replaced the code grant with a hashed, single-use, 60s one-time
token), and the server address is a build input, not something typed on the phone.

**Not verified, and not tickable from here.** The acceptance criterion is half met: an APK builds and is signed with a
real key, but nobody has installed one on a phone. Outstanding, all needing hardware or hands:

- installing the APK on a device, and the iOS path in full — Xcode signing, a Personal Team, Developer Mode
- ✅ the passkey ceremony, run on a real phone and working (2026-10-19). The `SALDO_SCHEME` round trip is part of it
- VoiceOver over the app, and the largest Dynamic Type setting
- the app-switcher cover as the OS actually photographs it
- the two Maestro flows, never executed. Their author's own estimate of first-run success is ~50% and ~35%; the
  selectors are `testID`-addressed and justified line by line, the risk is the gestures around the keyboard
- README screenshots, which do not exist yet: the four links are correct and will resolve the moment they land

**Acceptance:** a person following only the docs on a clean machine produces an installed APK and an iOS build connected to a
self-hosted server.

### Form architecture — how the app asks for things ✅ done

Asked for by the user on 2026-09-11. The investigation is `2026-09-11-form-architecture.md`; it
decided, per form (transaction, budget, account, category, tag), whether the screen stays flat,
becomes multi-step, becomes a list of rows opening their own pickers, or carries fewer fields, and
it held the transaction form apart on purpose — there the cost that matters is taps per entry, not
fields per screen.

Implemented by `2026-09-11-10-form-ui.md`, all steps including the device checks: `Screen` fades its
content into the footer instead of cutting it on a hard edge and keeps the save button and the taps
above the keyboard; the transaction form keeps its five frequent fields on the first screen with the
other four behind one disclosure; the account and category forms are three cards with their pickers
behind rows, sharing one colour-and-icon sheet; the tag editor is a card on the tag screen rather
than a sheet over it.

### UI scoping — motion, the transaction form, date entry ✅ decided

Asked for by the user on 2026-09-11 as three **investigations**. All three ended in a decision;
`2026-09-11-ui-scoping.md` carries each one with its reasoning.

- **A. Motion** — decided and built 2026-09-11. Reanimated 4, a token scale, four presets in
  `src/theme/motion.ts`, counting numbers, lists that close up when filtered, staggered Home cards,
  skeletons behind a 180ms grace. Reduce Motion is honoured by construction.
- **B. The transaction form** — decided 2026-09-13. Account and date above the grid; the grid caps
  at seven plus "Altro"; "Dettagli" hides tags, attachments, repeat and `excludeFromTotals` while
  the description stays out; the recents rule moved to `packages/core/src/recents.ts` and ranks on
  the last 90 days; and no primary button is ever silently disabled. The timed fast path was
  deferred by the user on 2026-09-13 — the form was already reordered around the two fields every
  transaction sets, so counting taps would have confirmed that rather than changed it.
- **C. Date entry** — decided and built 2026-09-11. Drawn, not native:
  `@react-native-community/datetimepicker` is gone, `src/components/Calendar.tsx` draws the month
  grid, and `CustomRangeSheet` uses the same component in range mode, so there is one calendar.
  "Oggi" and "Ieri" stay chips on the form, so the common case opens no sheet at all.

### Web redesign — top bar, one column, new pages ✅ done

Specs: `specs/2026-10-20-web-home-redesign.html` (H1–H12) and `specs/2026-10-21-web-pages-redesign.html`
(W1–W12). Branch: `redesign/web`. Seven plans, each one ends with software that works:

- [x] **R1** — the top bar and the new Home (`plans/2026-10-21-web-redesign-r1-shell-home.md`).
- [x] **R2** — the centred dialog, and the edit form opened from a transaction row (W1–W4)
  (`plans/2026-10-21-web-redesign-r2-dialog.md`).
- [x] **R3** — Transactions (W5) (`plans/2026-10-21-web-redesign-r3-transactions.md`).
- [x] **R4** — Statistics (W6–W8) (`plans/2026-10-21-web-redesign-r4-stats.md`).
- [x] **R5** — Accounts (W9) (`plans/2026-10-21-web-redesign-r5-accounts.md`).
- [x] **R6** — Profile and Admin (W10) (`plans/2026-10-21-web-redesign-r6-profile-admin.md`).
- [x] **R7** — empty states and the new `@saldo/core` functions (W11) (`plans/2026-10-21-web-redesign-r7-empty-states.md`).
- [x] **Command palette** — “Search” in the top bar, and the palette that `⌘K` / `Ctrl K` opens on every page
  (`plans/2026-10-23-web-command-palette.md`, spec `specs/2026-10-23-web-command-palette.html`). It closes
  open item 5 of the home redesign spec.

**Acceptance for R1:** no sidebar on any width; the top bar and the content share the 1040px column;
the Home shows Summary, Budget, Transactions and Goals in this order; the trend moves with the pointer
and with ← → Home End; «Coming up» shows the nearest date first; a closed period shows 10 latest rows.

**Acceptance for R2:** a detail opens in a 440px dialog and a form in a 480px dialog, in the centre
of the screen; below 760px both are sheets at the bottom; a transaction row opens «Edit transaction»;
«Delete» in its foot deletes at once and the toast offers «Undo»; ↑ ↓ move along the rows.

**Acceptance for R3:** Transactions shows one summary block (three cells, two in a closed period),
one tool row (search, Account, Category, Tag, «Expenses only», «More») and one list block; each row
has the category icon in its colour and no chips; the key hint shows under the list with a mouse.

**Acceptance for R4:** Statistics shows the period block (Expenses, Income, Net, projection, and
«Expenses by period» with one bar for each period and a dashed «usual» line), the breakdown in the
colours of the categories with share bars and «Committed share» as its last line, and the tags; a
bar and ← → select the period; a forecast period shows its recurring transactions and the forecast
table; the period trend is gone from the page.

**Acceptance for R5:** Accounts shows the net worth block, one row for each account in «To spend» and
in «Savings and investments» (no cards), a Goals block of its own with 40px rings, and the archived
row; the account dialog has «Archive account» and «Edit» at its bottom.

**Acceptance for R6:** the avatar opens a menu with the name, the email, «Profile» and «Sign out»;
the top bar has no Admin icon; Profile has a 220px menu in the groups Account, Organise (with
counts), Connections and data, and «Admin · ‹instance›» for the admin role only, then «Sign out»;
`/admin/*` keeps its routes and its guard and shows the same frame; below 760px `/profile` is the
list of groups and a section has a way back.

**Acceptance for R7:**
- A new user sees «Getting started» on the Home, and the blocks with no data do not show.
- Transactions:
  - with no transaction, it has a quick add;
  - a search with no result lists the other periods that match.
- An empty period of Statistics links to the nearest period with data.
- Accounts offers the account types, Goals offers three presets, and Budgets offers «Where you spend most».
- Tags and Invites show their form in the page.
- `budgetSuggestions`, `matchesInOtherPeriods` and `emergencyFundTarget` are in `@saldo/core`, with tests.

**Acceptance for the command palette:**
- From 1000px the top bar shows “Search” with the shortcut. Below 1000px it does not show “Search”.
- `⌘K` and `Ctrl K` open and close the palette at every width. `Esc` closes it, and the focus goes back.
- The palette finds pages, actions, accounts, goals, budgets, categories, tags and transactions (by title and by amount).
- The last row opens `/transactions?q=…` with the query.
- The Server Action reads the data of the signed-in user only. A test on PGlite makes sure of it.
- `rankSearch` is in `@saldo/core`, with tests.

### Notifications for future transactions

Moved to `ROADMAP.md` (0.1) on 2026-10-19.

### Backlog from hands-on use 🚧 planned

**Plan:** `2026-09-13-11z-backlog-cleanup.md`, which closes the transfers bullet below, moves the recents rule into
`@saldo/core` on a 90-day window, gives every form a reason when it will not save, and corrects the §B entry that
still describes the shipped "Dettagli" disclosure as pending. Independent of phase 11 in both directions.

Small things the user hit while using the app on 2026-09-11. None of them blocks 10 or 11; each is
small enough to land on its own branch without a plan file of its own.

- ✅ **Attachments are invisible on the transaction detail screen.** Done on 2026-09-11:
  `app/transaction/[id].tsx` draws the 96×124 receipt tiles §6.6 asks for, `AttachmentTile` is
  shared with the form strip so a PDF and a receipt look the same in both, and a row whose bytes
  this device does not hold says so rather than showing nothing — tapping it opens the viewer,
  which is what fetches them.
- ✅ **Motion.** Done on 2026-09-11 as investigation **A**, whose write-up now carries the
  decisions: Reanimated 4, a token scale, four presets in `src/theme/motion.ts`, counting numbers,
  lists that close up when filtered, staggered Home cards, and skeletons behind a 180ms grace.
  Reduce Motion is honoured by construction and nothing is said by motion alone.
- ✅ **The categories list needs a better shape.** Done: `app/settings/categories.tsx` draws one
  row per top-level category instead of a tree carried by a 32px indent — the children live behind
  the row, usage rolls up into the parent (`rollUpCategoryUsage`), and the row leads to the category
  detail that shows what was spent, not only to *edit*. Archiving stays the only way out, with the
  option of moving the rows.
- ✅ **Seeing transactions across accounts.** Both gaps behind it are closed:
  - ✅ `TransactionFilters.accountId` is now set, both ways: an account's "Ultime transazioni"
    opens the list filtered to it, and the list has its own account chip opening a single-select
    sheet (archived accounts included — filtering to one you no longer use is exactly when you
    reach for this).
  - ✅ **Transfers can be listed.** `direction` gained a `transfer` value and the list a "Solo
    trasferimenti" chip, sharing the `swap` icon the transfer row already uses. The
    "N trasferimenti nascosti" note stays quiet under it, since that chip shows them rather than
    hiding them.
- **The icon picker announces raw library identifiers.** Found in the phase 11 accessibility
  sweep and deliberately left. `AppearanceSheet`'s icon grid labels each tile with its own name —
  `piggy`, `grip`, `chevUD` — so VoiceOver reads English identifiers in an Italian app. The
  palette beside it was fixed in the same sweep because ten colour names are a bounded piece of
  content; roughly a hundred icon names are not, and machine-translating nouns for glyphs would
  be worse than the present state, because it would look finished. Left for whoever can name them
  properly: one `icons.<name>` entry per `ICON_NAMES` member in both catalogues, with the grid
  reading ``t(`icons.${name}`)`` the way the swatches now read ``t(`colors.${name}`)``.

### Picked up from `TODO.md` on 2026-09-15 ✅ done

**Plan:** `2026-09-15-refresh-swipe-segmented.md` · **Spec:** §8.5, §6.29, §6.32

- ✅ **Pull to refresh.** `Screen` takes `refreshable`, the Transactions list is a `SyncScrollView`,
  and `useSyncRefresh` runs the scheduler's `syncNow`. The spinner follows the pull; a pull that
  could not sync says so in a toast. Found on a device afterwards: the top inset has to sit outside
  the scroll view (inside it, iOS drew the spinner under the status bar); Transactions scrolls as a
  whole with its period, search and chips pinned, so a pull anywhere syncs; and a pull counts only
  when the drag starts at the top, because a fast fling back up bounced past the threshold.
- ✅ **No swipe-back under the tabs.** The cause was `replace` swapping only the top of the root
  stack: unlocking over a pushed screen left a second copy of the tabs. `enterTabs` and `startOver`
  (`src/navigation/history.ts`) are tested against the real router, and `(tabs)` and `lock` have
  `gestureEnabled: false`.
- ✅ **Account type toggle in onboarding step 2.** `Segmented` keeps a label on one centred line,
  shrinking to 80% before it truncates, and `accountTypes.checking` is now "Conto" / "Bank"
  (the onboarding name placeholder follows).

### Picked up from `TODO.md` on 2026-09-17 ✅ done

**Plan:** `2026-09-17-delete-all-data.md` · **Spec:** §6.8, §8.6, §14

- ✅ **Delete all data.** Profile → "Elimina tutti i dati" deletes the account's rows and attachments on the server
  (`DELETE /api/data`) and on every phone, keeps the session and returns to onboarding. A per-account data epoch
  makes other phones empty themselves on their next sync instead of pushing deleted data back.

### Picked up from `TODO.md` on 2026-09-17 ✅ done

**Plan:** `2026-09-17-debit-card.md` · **Spec:** §4, §6.29

- ✅ **Debit card as an account type.** `debit_card` is its own account, behaving like `checking`. The mobile app
  reads the list from `accountTypeSchema.options`, and onboarding step 2 picks the type from a tile grid with all six
  types. `SYNC_SCHEMA_VERSION` stays at 1.

### Picked up from `TODO.md` on 2026-09-17 ✅ done

**Plan:** `2026-09-17-negative-balances.md` · **Spec:** §5.1, §6.22, §6.29

- ✅ **Negative account balances.** The account sheet and onboarding step 3 show a `±` switch before the amount, and
  a typed minus is kept. Editing an account below zero no longer saves it as positive: `minorToAmountBuffer` used to
  drop the sign.

### Picked up from `TODO.md` on 2026-09-17 ✅ done

**Plan:** `2026-09-17-onboarding-import.md` · **Spec:** §6.29, §11.3

- ✅ **Import during onboarding.** A chooser before step 1 starts from scratch, from a CSV export, or from a Saldo
  backup. The import path is period, currency, the import wizard, and one current balance per imported account,
  stored as an opening balance; nothing is written until "Inizia". `applyImport` no longer twins a name that exists
  by the time it writes.

### Picked up from `TODO.md` on 2026-09-22

**Plan:** `2026-09-22-card-settlement.md` · **Spec:** §5.3, §6.10, §6.16, §6.22

- **Credit cards: settle the card from its payment account.** "Addebitata su" in the account sheet; the card box
  shows the closed statement still due (`creditStatementDue`) and "Salda carta" opens a pre-filled transfer
  (statement or whole balance, dated on the charge day); a 09:00 reminder on the charge day opens the card; a
  transfer that takes a card into credit is flagged, not blocked. No schema change. Awaiting a device check.

### 12 — Recurring transactions ✅ done

**Plan:** `2026-09-19-12-recurring-transactions.md` · **Spec:** §4 (Recurrence), §5.9, §6.2, §6.6, §6.16, §6.33, §6.34
· **Mockup:** `docs/superpowers/mockups/2026-09-18-recurring-transactions.html` (form: variant A, tab: variant B)

- Every N days/weeks/months/years, end on a date or after N times; "Ripeti" as a chip row in the form.
- "Ricorrenti" card on the Transactions tab → list with monthly totals → detail with cadence, end, occurrences and
  "Smetti di ripetere". ↻ badge on occurrence rows. No pause.

**Acceptance:** create a bi-weekly expense and see its occurrences up to the end of next cycle; change its end and
its cadence from the detail; stop it and see only the future go; `SYNC_SCHEMA_VERSION` stays 1 (documented).

**Status:** met on iOS. Lint, typecheck and the 434 mobile / 352 core tests are green; the flows above were driven
on the simulator with Maestro (see the plan's status section). Changing the cadence from the detail is covered by
`recurrenceService.test.ts` and was not tapped through on the device. Android unverified, as for every phase.

### Picked up from `TODO.md` on 2026-10-07 ✅ done

**Plan:** `2026-10-07-web-panel-feel.md` · **Spec:** `specs/2026-10-07-web-panel-feel.html`, §17.1.7

- **Web: the Transazioni panel opens in the frame of the click.** The panel is client state and the URL follows
  it with `history.pushState`; the server renders every row's detail and the new form. The list makes room with
  a transition on its grid track. `N` and ↑ ↓ open without motion. «Modifica» is still a navigation.

**Status:** met. The targets come from the measurements during the work: «New transaction» 40 ms at CPU 1× and
100 ms at 4×, and a row's longest frame 70 ms (one run of six was 76 ms). At CPU 4× the panel shows 59 ms after the
input for «New transaction» (before: 294 ms from the click), 17 ms for a row (before: 187 ms) and 38 ms for the FAB
(before: 228 ms), with 0 server requests. The ✕ takes 166 ms. The
`/transactions` document grows from 99.7 KB to 156.7 KB (14.7 KB to 19.8 KB gzip). Lint, typecheck and tests are green.

### Web G2 redesign — sidebar, dialog panels, the G2 pages ✅ done

Plan: `2026-10-11-web-g2-redesign.md`. Spec: `specs/2026-10-11-web-g2-layout.html`.
Mockups: `mockups/2026-10-11-web-home-polish-variants.html?variant=G2`,
`mockups/2026-10-11-web-pages-g2-variants.html?variant=K`.

Acceptance:

- At 1440×900, every page matches its mockup in both themes. The commit bodies list each kept difference.
- No panel moves the page. Esc, ✕ and the scrim close it. Tab stays inside it.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and the Playwright suite pass.
- At 390×844, every page works as before (top bar, tab bar, full-screen panels, bottom-sheet forms).

**Status:** met. Lint, typecheck and tests are green. The Playwright suite passes (77 passed, 1 skipped). Screens at
1440×900 in both themes and at 390×844 match the mockups. The translations in es, pt, fr, de and sv need a review by a
native speaker.

### 0.8a — Marketing site: the landing page ✅ done

Plan: `2026-10-18-0.8a-site-landing.md`. Spec: `specs/2026-10-18-marketing-site.html` (D41–D52).
Mockup: `mockups/2026-10-18-marketing-site-product.html`.

A new static app, `apps/site` (Astro), with one English page. The phone screens are drawn from the `@saldo/ui`
tokens, and their strings come from `@saldo/i18n`. The site is its own Vercel project; `SITE_URL` gives the domain.

Acceptance:

- The page matches the mockup at 1440 and 390, in both themes. No text clips. The console has no errors.
- Without JavaScript, all content shows and the carousel scrolls.
- The theme toggle sets light and dark. After a reload there is no flash.
- Every call to action goes to the repository or the self-hosting guide.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. The site has no automated tests and no carousel physics: the user
  decided so on 2026-10-19 (D52). The carousel is native scroll with CSS scroll-snap, plus the buttons, the keys and the
  progress.
- A misspelt app string key fails `astro check`. A key that a catalog lacks fails the build.
- Lighthouse, mobile: Performance, Accessibility, Best practices and SEO each ≥ 95 (spec §07).

**Status:** met, with one budget miss. On 2026-10-19: `pnpm lint` is clean, `pnpm typecheck` passes in all six packages
(`site`: 0 errors, 0 warnings, 0 hints), and `pnpm test` passed in all six (`site`: 13 passed; the site lost its tests later, see below). Three mobile suites
timed out at 5 s on the first run after the `@saldo/ui` change, because the Jest cache was cold. They pass on the next run
(37 suites, 208 tests). Lighthouse, mobile: Performance 97 to 99, Accessibility 100, Best practices 100, SEO 100. One
Performance run of 87 showed a Speed Index of 12.8 s. Twelve more runs did not repeat it. A scripted browser load
showed the page final within 1.5 s.

After the code review, on 2026-10-19, fourteen fixes changed the site (high contrast, the carousel focus, the copy buttons,
44 px hit areas, Latin-only fonts, `theme-color`, the CI build and the Vercel files).

**Simplification, 2026-10-19.** The user asked for less code: «it is a simple marketing site». The site lost its tests
(13 tests, Vitest, the `test` script), the carousel physics (mouse drag, momentum, rubber band, spring) and the helper
files that served them. `scripts/carousel.ts` went from 249 to 63 lines. The theme logic has one source: the inline
script in `Base.astro`. `pnpm lint` is clean, `pnpm typecheck` passes in all six packages (`site`: 0 errors), and
`pnpm test` passes in the five packages that have tests. Turbo skips `site`. One Lighthouse mobile run: Performance 98,
Accessibility 100, Best practices 100, SEO 100. A scripted browser at 1440 and 390, in both themes, showed no console
error and no horizontal overflow. The buttons, the arrow keys, Home, End and a native scroll each land on a snapped card.

**Budget miss, resolved.** The first load is 146 KB gzip, against the 120 KB of spec §07. The four Geist font files are 113 KB of
it, and they do not compress. HTML is 19 KB, CSS 8.5 KB (23 KB before the fonts were limited to Latin), the script 2 KB
and `rocky-mark.png` 6 KB. On 2026-10-19 the user chose to raise the budget to 150 KB gzip (spec §07) and keep the
four font weights.

**`apps/site/vercel.json` without `ignoreCommand`, 2026-10-19.** The `ignoreCommand` (`git diff HEAD^ HEAD`) failed on the
first Vercel build with exit code 129, and was removed. A first attempt then removed the whole file. That failed too: with no
`vercel.json` in its root directory, Vercel used the root `vercel.json` of the web app (`framework: nextjs`), and the build
stopped with `NEXT_NO_VERSION`. The file is back with `framework`, `installCommand`, `buildCommand` and `outputDirectory`.
The project setting «Skip deployments when there are no changes» replaces the `ignoreCommand`. `SITE_URL` is optional.

Not checked: Safari, Firefox, a real phone, and hover and carousel states with an accessibility tool. A mouse can no
longer drag the carousel. It uses the buttons, the keys, the wheel with Shift, or a trackpad.

### 0.8b — Marketing site: the docs library ✅ done

Plan: `2026-10-20-0.8b-docs-library.md`. Spec: `specs/2026-10-20-docs-library.html` (D53–D60).

Starlight in `apps/site` shows five Markdown files in place (`docs/self-hosting.md`, `docs/building-android.md`,
`docs/building-ios.md`, `SECURITY.md`, `CONTRIBUTING.md`) and the Guide of the app, from `guide.*` in the English
catalog. The pages are under `/docs/`, in four groups, with Pagefind search. The Markdown files stay the source of truth.

Acceptance:

- Each docs page renders from the file that it claims to show. No page needs a copy or frontmatter in the file.
- Relative links in the files work on GitHub and on the site. No link on the site ends in `.md`.
- The Guide page lists the concepts of the app, in the order of the app.
- The docs pages use the `@saldo/ui` tokens and share the theme choice with the landing page.
- The landing page loads no new script, and its first load does not grow.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. Lighthouse, mobile: each category ≥ 95 on the docs pages.

**Status:** met on 2026-10-20. `pnpm lint` is clean. `pnpm typecheck` passes in all six packages (`site`: 0 errors,
0 warnings). `pnpm test` passes in the five packages that have tests (mobile 37 suites, 208 tests). The build writes
`/docs/`, `/docs/guide/` and the five Markdown pages. The link check found 300 internal links, all resolved, except
`#top` in `/og/` (it was there before, and `/og/` is not public). Lighthouse, mobile: Performance 99 to 100,
Accessibility, Best practices and SEO 100, on `/docs/`, the Guide, self-hosting, Android and security. The first load
of `/` is 262 560 B against 262 610 B before (the same measure, `rocky.png` included); the three scripts are the same.

Found during the build: Starlight turns on `prefetch` for every page, so `prefetch: false`. A cached render pointed to a
missing code stylesheet, so the build runs with `--force`. A late font swap moved `/docs/self-hosting/` (CLS 0.171), so the
docs head preloads Geist 400 and 600. The Guide section «Your data» and the concept «Your data» shared `#data`, so
section anchors come from the section titles.

Deployed on 2026-10-21. The Vercel upload needed `docs/`, `SECURITY.md` and `CONTRIBUTING.md` in the `.vercelignore`
allowlist: without them the docs collection was empty and the build failed. Each commit of PR #6 that changed only
guides started a deploy (D59).

Added on 2026-10-21: a clearer type scale for the docs pages (chosen from three variants), the guides rewritten in
Simplified Technical English, and eleven SVG diagrams in `docs/diagrams/`. `lib/repoLinks.ts` puts a diagram inline
and removes its `<style>`, so `styles/docs.css` colours it with the theme tokens. The guides now describe only what
the code does today: no milestone numbers, no notes for instances older than the first user.

Not checked: Safari, Firefox and a real phone.

### Picked up from `TODO.md` on 2026-10-19 ✅ done

**Plan:** `2026-10-19-profile-period-row.md` · **Spec:** §6.8

- ✅ **Profile: the period row.** The first row of Profile reads «Periodo» with the kind, or the cycle day for a pay cycle,
  and opens a screen with the four kinds. The web Profilo has the same panel, so it can change the period kind. Not run: the
  Maestro flows and a simulator check.

### Picked up from `TODO.md` on 2026-10-19 ✅ done

**Plan:** `2026-10-19-change-email.md` · **Spec:** §9, ROADMAP 0.3j

- ✅ **Change of a real email address.** The new address gets a link; the swap happens when it is opened; the old address
  gets a notice. The change is a row in `email_changes` (migration `0007`). Run `pnpm --filter web db:migrate` on a dev
  database. Better Auth's `/change-email` stays disabled.
- ✅ **E2E flow for the change of email.** `apps/web/e2e/change-email.spec.ts` follows the link from the mail sink to
  the swap and the notice. It points the instance at the sink with `configureSmtp`, so `e2e/env.ts` keeps `SMTP_*` blank.
- ✅ **Safer change of email.** Plan `2026-10-24-email-change-fresh-passkey.md`, spec
  `specs/2026-10-24-email-change-fresh-passkey.html`. A change of a real address needs a session that a passkey
  ceremony created in the last 5 minutes; an older one gets `403 reauth_required`, and the Profilo form asks for the
  passkey with a button. The undo link in the notice is not built: the thief can use recovery before the owner reads the mail.
- **Not fixed, on purpose: `POST /api/me/email` answers `409 email_taken` on the synthetic path.** That path serves only
  accounts from before D32. Registration says «this email already has an account» by decision 7 of
  `2026-09-27-0.3b-web-auth.md`, so the answer is not a new leak. A false `200` would make the phone think that the
  address is saved. A uniform `202` with a link needs a change in the phone (`saveEmail`) and takes away the fill on a
  server without SMTP.

## Future (not POC)

- Web app UI (spec §17.1)
- AI receipt analysis, BYOK (spec §17.2)
- AI spending insights, BYOK (spec §17.3)
- Native passkeys (spec §9.4)
