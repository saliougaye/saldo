# Saldo — POC Product & Architecture Spec

- **Status:** Approved for implementation
- **Date:** 2026-09-10
- **Audience:** implementing agents (LLMs) and human contributors
- **Design source of truth:** `docs/design/Spese.dc.html` (see `docs/design/README.md` for the line map)
- **Roadmap / plans:** `docs/superpowers/plans/README.md`

---

## 1. Product overview

Saldo is an open-source, self-hostable personal finance app, built as a free replacement for Spendee's paid
features. Anyone can clone the public repo, build the Android APK or iOS app on their own computer, sideload it,
and optionally run their own server for passkey login, multi-device sync, and attachment backup.

The mental model comes from the design: money is tracked per **cycle**, a "month" that starts on payday (for
example the 27th), not on the 1st. The Home screen answers one question: *how much is left to spend in this
cycle, and am I going faster than I should?*

### 1.1 Goals (POC)

1. Every feature visible in the design (§6), working on Android and iOS against a local database.
2. **Local-first, one account when you want one.** Every read and write is local, so the app is fully usable
   offline — and usable with no server at all: the first run offers «Solo su questo telefono» next to signing in
   (§6.29 step 0). An account on the user's own server, signed in to then or later from Profile (§6.30), adds sync;
   the account and the database are the user's, so it is not a hosted dependency.
3. **Passkey authentication** against that self-hosted Next.js server, which is also what enables sync.
4. **Sync** of all data between devices through that server.
5. **Attachments** (receipt photos/PDFs) on transactions, synced.
6. **Import & export:** full JSON backup/restore, CSV export, CSV import (generic mapping + Spendee preset).
7. **i18n:** Italian (source copy from the design), English, French, German, Swedish, Spanish and (European)
   Portuguese.
8. **Monorepo** with domain logic and design tokens shared across the mobile app and the (future) web app.
9. Documented local builds for the **Android APK** and **iOS sideload**. No app stores.

### 1.2 Non-goals (POC)

- Web app UI. `apps/web` exists in the POC only to host the API and the passkey web ceremony pages.
- App store distribution, EAS cloud builds, OTA updates.
- Bank connections or automatic transaction feeds.
- Multi-currency conversion and per-account currencies (one currency per app; switching currency re-formats and does
  not convert, as in the design). Correct conversion needs *historical* rates per transaction date — with today's rate
  past totals, budgets and statistics would silently change as rates move — so it belongs to its own phase.
- Shared budgets or households (the server can be multi-user, but data is never shared between users).
- AI features (see §17; they are future iterations with bring-your-own-key).
- Nothing shorter than a week or longer than a year as a period: §5.2's four kinds (month, week, pay cycle, year) plus
  an arbitrary range cover what the design offers. A fortnightly or four-weekly *recurring* period is not among them.
- A first run with no network can still start on the phone; only the server door needs one, and it says so in the
  server row (§6.29 step 0).

---

## 2. Decision log

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | **pnpm workspaces + Turborepo** monorepo | pnpm 10 is already installed; Turborepo gives cached task graphs. Both are standard for Expo + Next monorepos. |
| D2 | **Expo (React Native) + Expo Router** for mobile | Native gestures, sheets and keyboard; local builds through `expo prebuild` + Gradle/Xcode, no EAS required. |
| D3 | **Next.js (App Router)** for `apps/web` | Hosts the REST API (route handlers) and the passkey ceremony pages; becomes the web app later. |
| D4 | `packages/ui` contains **tokens and icon data only**, with no rendering components | The user asked for UI sharing to stay renderer-agnostic. Each app renders with its own primitives (RN `View`/`Text`/`react-native-svg`, web DOM/SVG). |
| D5 | `packages/core` is **pure TypeScript** (no React, RN, Node or DOM APIs) | Runs identically on Hermes, Node and browsers; 100% unit-testable with Vitest. |
| D6 | Internal packages ship **TypeScript source** (`exports` → `./src/index.ts`), with no build step | Metro and Next (`transpilePackages`) compile them directly. Simpler for forks. |
| D7 | Money is stored as **integer minor units** of the app currency | No floating-point drift. The scale is the currency's CLDR exponent (`minorDigits`: 0 for JPY/ISK, 2 for most, 3 for KWD), so every amount is read together with `settings.currency`. |
| D8 | Dates of transactions are **`LocalDate` strings `YYYY-MM-DD`** with no time zone | A finance entry belongs to a calendar day, not an instant. Metadata timestamps are ISO-8601 UTC. |
| D9 | **Local-first**: SQLite on device (`expo-sqlite` + Drizzle ORM) is the source of truth | The user chose local-first + sync. |
| D10 | **Custom row-level LWW sync** with hybrid logical clocks (HLC) over a small REST API | Single-user, multi-device data; row-level last-writer-wins is enough and has zero vendor lock-in for self-hosters. PowerSync, Electric and Zero were considered and rejected: extra services to self-host, and licensing/complexity. |
| D11 | Server stores synced entities in **one generic `sync_rows` table (JSONB)**, validated by `@saldo/core` Zod schemas | The server has no relational business logic in the POC. Avoids maintaining two relational schemas. A typed projection can be added when the web app needs queries. |
| D12 | **Postgres + Drizzle** on the server; **PGlite** in server tests | Self-host friendly (docker compose); tests need no Docker. |
| D13 | **Passkeys via `@simplewebauthn/server` + `@simplewebauthn/browser`**. Mobile signs in through a **system browser auth session** (`expo-web-browser` `openAuthSessionAsync`) with PKCE | Native passkeys need Associated Domains on iOS, which free Apple IDs cannot sign. The browser session works on both platforms for sideloaded builds. Native passkeys are a documented future improvement. |
| D14 | Access token = short-lived **JWT (15 min, `jose`)**; refresh token = opaque random (90 days, rotating, stored hashed) | Standard, revocable, simple. |
| D15 | **Attachments** stored on device (`expo-file-system`) and on server disk (`STORAGE_DIR`) behind a `BlobStorage` interface | Simplest self-host; an S3 driver can be added later. |
| D16 | **i18next + react-i18next**, catalogs in `packages/i18n`. Number/money/date formatting uses **hand-written deterministic formatters**, not `Intl` | Hermes and Node `Intl` data differ (grouping rules, month abbreviations). The design requires exact output such as `1.842,60 €` and `27 mar – 26 apr`. |
| D17 | **Biome** for lint + format | One fast tool, zero plugin config. |
| D18 | **Vitest** for `packages/*` and `apps/web`; **jest-expo + React Native Testing Library** for `apps/mobile`; **Maestro** for optional mobile E2E flows | Best-supported runner per environment. |
| D19 | **MIT license** | The user wants anyone to clone and release freely. |
| D20 | App identity (name, bundle id, URL scheme) configurable via env in `app.config.ts` | Forks must be able to sideload their own build without clashing ids. |
| D21 | Scheduled occurrences of recurring transactions have **deterministic ids** `${recurrenceId}:${occurrenceDate}` | Two devices generating the same occurrence offline converge to one row after sync. |
| D23 | Amounts are typed on **Saldo's own keypad**, not on the device keyboard (reversed 2026-09-22; it said the opposite before) | Saldo then draws the keys, so they are identical on iOS and Android, the decimal separator follows the *app's* language instead of the device's, and a balance gets a `−` key where a calculator has one — none of which `decimal-pad` could offer: it has no minus key on iOS, and Android has no `InputAccessoryView` to add one beside a «Fatto». The field stays a `TextInput` with `showSoftInputOnFocus={false}`, so it keeps its caret, its selection and its screen-reader semantics, and a hardware keyboard or a paste still reaches it through `sanitizeAmountInput`, which still accepts `.` and `,`. The cost is the room the pad takes: `Screen` hosts it under the footer and reserves its height, and the two onboarding amount steps keep it up with «Continua» on its tall key. |
| D22 | **TanStack Query is used for the network layer only** (auth + sync, phases 06–07), never for local reads | Local reads are already reactive through the `expo-sqlite` change listener, with SQLite as the single source of truth; a query cache on top would have to be invalidated by hand on every mutation, re-implementing what the listener does for free and inviting stale-screen bugs. React Query caches *server* state, and on a local-first device there is none. It earns its place on retries, backoff, dedup and `onlineManager` for the sync and auth calls, driven imperatively through `QueryClient` rather than by component mounts (§8.5 runs sync on app start, foreground and after writes, not on mount). |
| D24 | **A goal is a pocket**: an account of type `pocket` that lives inside a real account and carries the goal's target and deadline (decided 2026-09-24) | Setting money aside is then a transfer into the pocket, so a goal reuses the whole ledger: balances, Totale spendibile, recurrences (an automatic contribution is a recurring transfer), export and sync. It is the only model considered that is both backed by real balances and usable by someone whose only account is a current account. A goal pointing at an existing savings account fails that user and holds one goal per account; earmarks kept outside the ledger re-implement pockets with a new entity, a new recurrence kind and a new spendable formula; a target with a hand-typed "saved so far" is a reminder, not a goal. Pocket and goal are one to one and are created and closed together, so the goal's fields live on the pocket's own row and no goal can dangle. Investment accounts cannot hold pockets: their returns land on the parent, so a pocket inside one would never grow. |
| D25 | Budget and Obiettivi on Home share one **target card** (§5.13): one item featured with a sentence that says what to do, the exceptions as rows, everything else behind one «Tutti …» row of rings (decided 2026-09-24 over three rounds of mockups) | A list of bars says where each item is, not what to do about it. The sentence turns the pace into an amount — per day for a budget, per period for a goal — and a single featured item keeps Home to one large figure per card. The exceptions (a budget over its limit, a goal reached or past its deadline) are the things that must not hide behind a tap, so they get rows of their own; being over *pace* is common and stays a dark ring. |
| D26 | **Rocky appears only where the user stops** (decided 2026-09-24, widened 2026-09-25): peeking over the «nothing yet» ghost stack, peeking over a reached goal's card, whole in the close sheet of a reached goal, waving on the welcome, asleep on the lock screen, waiting in a long labelled load, and small above the message of a failed import or restore. Never in a «nothing matches», a «not found», a toast, the pull-to-refresh or a short boot wait. He moves as the mascot kit's Lottie states; only the waiting ones (`loading`, `sleep`) loop | A mascot seen ten times a day is noise. Next to an error he stays small and still after one play, under the text that says what happened, so he sets the tone without making light of it. Lottie from the kit rather than PNGs: one source for motion and still, since Reduce Motion shows the kit's pose frame. Mockup: `docs/superpowers/mockups/2026-09-24-mascot-variants.html`, variant A+B |
| D27 | **A closed period is recapped once, in a sheet** (decided 2026-09-25): on the first open of a new period, for every kind including the week, a full-screen sheet recaps the period that just closed (§5.15), with a 09:00 notification that day. Once dismissed it cannot be reopened, and it is not shareable as an image | The switch to a new period was silent. A sheet makes it a moment; every kind gets one because the user wants the week recapped too. Reopening past recaps and sharing them are later ideas: the first has to survive changes of period kind, the second needs a native capture dependency and a decision on what a shared image hides. |
| D28 | **Saldo explains itself in three places, from one text** (decided 2026-09-26): a first-run intro of four ideas on one screen, an ⓘ next to what it explains opening a sheet, and a «Guida» in Profile with one page per concept. All three read `guide.<concept>.{title,summary,body}` through one typed list of concept ids (§5.16) | Nothing in the app said how it thinks: a period that restarts, «Rimasto da spendere» that is not a bank balance, a transfer that is not an expense. Apple's pattern — a few rows, «Continua», done — costs one tap; the ⓘ answers where the question comes up without coach marks or tooltips over the UI; the Guida is where the same text can be read again. One list of ids makes it impossible for the three to drift apart. A hint that compensates for an unclear label was fixed as a label instead (the generic «ciclo», «saldo disponibile»). Not a «Novità» sheet yet: there are no releases to compare (0.9). Mockup: `docs/superpowers/mockups/2026-09-26-guide-variants.html`, variants 1A, 2A, 3A |
| D29 | **The forecast lives in Flussi and opens a sheet** (decided 2026-09-26, mockup `docs/superpowers/mockups/2026-09-26-forecast-variants.html`, variant «Finestra + dettaglio»): on the current period the cashflow chart keeps its six columns but shows 2 closed + current + 3 forecast; the row «Al {data} circa {saldo}» under it opens a sheet with one row per forecast period (§5.7, §5.17) | Nine columns did not fit 320px without abbreviating every label; a scroll inside the chart hides half of it and duplicates the header's ‹ ›; a separate card or a balance line added UI the roadmap had left out. Three closed periods are enough on screen because the header already walks back, and the medians still read six. On the web's wide layout the chart shows six closed periods and doubles as the period picker (§17.1.7, 2026-09-27). |
| D30 | **The web app is server-side, at the root of the instance** (decided 2026-09-22 and 2026-09-26, §17.1) | Server components read the user's data through one typed projection of `sync_rows` into `@saldo/core`, which 0.4 and 0.5 reuse. A browser running SQLite WASM would duplicate the phone's engine. The root rather than a subdomain keeps the passkey's RP id and the cookie on one origin, with nothing new for a self-hoster to configure. |
| D31 | **The web app does not prepare for shared finances** (decided 2026-09-26) | Shared wallet or shared account is decided when that milestone starts, and it ships before the first release, so there are still no production rows to migrate then. Scoping queries for a model nobody has designed would guess at it; the web app keeps `where user_id = ?` like the sync, and shared finances change both together. |
| D32 | **An account has a real email** (decided 2026-09-26, §17.1.4) | It is how an admin, and later shared finances, know who somebody is. It is an identifier, not a credential: signing in stays passkey-only. Verification and recovery by magic link exist only when SMTP is configured, so registration never depends on mail. |
| D33 | **Product settings live in the database and change from `/admin`; infrastructure stays in the environment** (decided 2026-09-26, §17.1.8) | A self-hoster should not edit env files and restart to open registration or set an AI key. An env variable that sets the same thing wins and locks it, so existing deployments keep working. Secrets are encrypted at rest and write-only in the UI. |
| D34 | **Web UI in CSS Modules on generated token variables, behaviour from Base UI's headless primitives; chart geometry shared with the phone** (decided 2026-09-26, §17.1.7; Base UI added 2026-09-27) | CSS Modules add no styling dependency, and the tokens stay the only source of visual values. Dialogs, menus, selects and focus traps written by hand are where accessibility breaks, so their behaviour comes from Base UI, which renders no look of its own. shadcn/ui on Tailwind was the alternative: faster to write and able to enforce tokens through `@theme`, but its value is a look Saldo would restyle anyway, at the cost of a second styling dialect beside the phone's and several dependencies. A chart library would draw different charts and re-implement the forecast band; pure geometry functions keep both renderers on one set of numbers. |
| D35 | **The marketing site and docs library are their own app, `apps/site`** (decided 2026-09-26, supersedes the roadmap's «inside `apps/web`») | An instance build should not carry, or need a flag to hide, a site that advertises the project. `apps/site` shares `@saldo/ui` and `@saldo/i18n` and reads the Markdown in `docs/` in place. |
| D36 | **The AI provider key is one per instance**, set by the admin in `/admin` (decided 2026-09-26, for 0.5) | One household per instance is the case Saldo serves; the admin pays and every client, phone and web, uses the same key. |
| D37 | **The user's time zone is a synced setting, not a cookie** (decided 2026-09-26, §17.1.5) | The server computes «today» for the web, and from 0.4 for MCP and AI, which have no browser to send a cookie. A cookie is also missing on the very first request. `settings.timeZone` is filled at onboarding and changed by hand, as Sure does with `families.timezone`; it does not follow a travelling device, so two devices in different zones do not overwrite each other and a period closes where the user lives. Profile shows it and warns only when the phone's zone differs (mockup `docs/superpowers/mockups/2026-09-26-timezone-variants.html`, variant «Viaggio + ora»): travelling is the one moment when the web and the phone can disagree about today. |
| D38 | **MCP (0.4) and AI insights (0.5) both ship; insights are built on the MCP tool functions** (decided 2026-10-01) | Two audiences on one instance: the technical user already running Claude Code or another MCP client connects their instance and combines it with their other integrations, and never gives Saldo a key; the non-technical member of the same instance wants the insights in the app with nothing to set up, and the admin holds the key anyway (D36). The cost of two paths is two descriptions of the user's finances that can drift; so the insights prompt is fed by the same tool functions MCP exposes, called in-process, and §18 describes what a model is told once, for both. MCP ships first: no key, no consent screen, no prompt to tune, and the tool shapes are tested there before a prompt depends on them. |
| D39 | **The MCP endpoint is protected by OAuth 2.1 only; no personal access tokens** (decided 2026-10-03, §17.4.1) | One credential surface to describe and defend. OAuth is what the connectors of claude.ai and the Claude apps accept, and Claude Code, Cursor and the CLIs speak it too (directly or through `mcp-remote`); a pasted token would have served only the second group and doubled §18. Saldo is its own authorization server through `@better-auth/oauth-provider` on the Better Auth instance already there: dynamic registration, PKCE, opaque tokens stored hashed and checked on every call, so revoking in Profile stops the next request without waiting for a JWT to expire. |
| D40 | **MCP ships reads and writes, under two scopes (`read`, `write`)** (decided 2026-10-03, §17.4.2) | An assistant that can only read answers questions; one that can also write saves the typing, which is the point of talking to it. The write perimeter is exactly the web's (§17.1.3) and goes through the same server write functions, rules and `basis` check, so there is nothing new to defend; what is new is the consent, hence the two scopes the user sees and can halve. Reads ship first (0.4a) and writes second (0.4b), on the same catalogue. |

Always install the latest stable versions at implementation time and record them in the lockfile. Don't invent
version numbers. If a library API differs from what a plan shows, follow the library's current docs and update
the plan's code in the same commit.

---

## 3. Architecture

### 3.1 Repository layout

```
saldo/
├─ apps/
│  ├─ mobile/                 Expo app (Android + iOS)
│  │  ├─ app/                 Expo Router routes (tabs, stacks, sheets)
│  │  ├─ src/
│  │  │  ├─ db/               Drizzle SQLite schema, migrations, repositories
│  │  │  ├─ sync/             sync client (push/pull, HLC clock, scheduler)
│  │  │  ├─ auth/             server connection, auth session, token store
│  │  │  ├─ attachments/      capture, compress, local store, upload queue
│  │  │  ├─ io/               import/export (file pick/share glue)
│  │  │  ├─ theme/            ThemeProvider, useTheme, Text/Icon primitives
│  │  │  ├─ components/       RN components (Card, Row, Sheet, Keypad, Toggle, Chip, …)
│  │  │  ├─ features/         screen-level feature modules (home, transactions, stats, …)
│  │  │  └─ i18n/             i18next init for RN
│  │  └─ app.config.ts
│  └─ web/                    Next.js app (API + passkey pages; web UI later)
│     ├─ app/api/…            route handlers
│     ├─ app/auth/…           passkey ceremony pages
│     ├─ src/server/          db (Drizzle pg), auth, sync, storage
│     └─ docker/              Dockerfile, docker-compose.yml, Caddyfile example
├─ packages/
│  ├─ core/                   @saldo/core: domain model, rules, calculations, sync protocol types, CSV/JSON io
│  ├─ ui/                     @saldo/ui: design tokens + icon data (renderer-agnostic)
│  ├─ i18n/                   @saldo/i18n: message catalogs (it, en) + deterministic formatters
│  └─ tsconfig/ (optional)    shared tsconfig presets if base file grows
├─ docs/
│  ├─ design/                 imported design (source of truth)
│  └─ superpowers/            specs + plans
├─ AGENTS.md                  instructions for implementing agents
├─ LICENSE (MIT) · README.md · CONTRIBUTING.md
├─ biome.json · turbo.json · pnpm-workspace.yaml · tsconfig.base.json
```

### 3.2 Dependency rules (enforced by review; add a lint check if cheap)

```
apps/mobile ─┬─> @saldo/core
             ├─> @saldo/ui
             └─> @saldo/i18n ─> @saldo/core
apps/web ────┬─> @saldo/core
             ├─> @saldo/ui   (web UI later)
             └─> @saldo/i18n
@saldo/core  ─> zod, uuidv7, papaparse   (nothing else; no platform APIs)
@saldo/ui    ─> (no deps)
```

- `packages/*` never import from `apps/*`.
- `@saldo/core` has no `Date.now()` or randomness hidden inside calculations. `today`, clocks and id generators
  are passed in, so tests are deterministic. The only exception is `newId()` in `ids.ts`.
- Screens never compute business numbers inline. They call `@saldo/core` functions with data loaded by
  repositories.

### 3.3 Runtime data flow (mobile)

```
UI (screens) ──read──> useLiveQuery (Drizzle, expo-sqlite change listener) ──> repositories ──> SQLite
     │                                                              ▲
     └──write──> repository.mutate() ── stamps HLC + sync_state=pending ─┘
                                           │
                        SyncScheduler ─────┴─> POST /api/sync/push → GET /api/sync/pull → apply LWW → SQLite
```

---

## 4. Domain model

All synced entities share **sync metadata**:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | UUIDv7 generated on the client (`newId()`), except recurrence occurrences (D21) and settings (`"settings"`). |
| `createdAt` | ISO string | UTC. |
| `updatedAt` | HLC string | See §8.2. Lexicographically comparable. |
| `deletedAt` | ISO string \| null | Tombstone. Rows are never hard-deleted while sync is possible. |

### 4.1 Entities

**Settings** (singleton, `id = "settings"`)

| Field | Type | Rules |
| --- | --- | --- |
| `periodKind` | `month \| week \| cycle \| year` | How the user tracks spending (§5.2). Default `month`; onboarding step 1 asks. |
| `cycleStartDay` | int 1–28 | Default 27 in design; asked only when `periodKind` is `cycle`, and remembered when it is not. Clamped per month (§5.2). |
| `currency` | `CurrencyCode` | Any of the 162 ISO 4217 codes CLDR can format (`CURRENCY_CODES`). One for the whole app; `EUR/USD/GBP/CHF` are shown first in the picker. |
| `language` | `system \| it \| en \| fr \| de \| sv \| es \| pt` | `LANGUAGE_PREFERENCES`. Widened from `system \| it \| en` before any public build, so `SYNC_SCHEMA_VERSION` did not move; a later widening needs a changelog line. |
| `theme` | `system \| dark \| light` | Design default dark. |
| `onboardingCompletedAt` | ISO \| null | |
| `timeZone` | IANA name \| absent | Where the user's day starts and ends, for everything the **server** computes (§17.1.5). Filled at onboarding from the device, changed only by the user in Profile: travelling does not move it. Optional, so rows written before it existed still parse. A phone that onboarded before it existed fills it on boot, once its settings row is synced. The phone keeps its own clock for what it computes locally. |

Device-local (not synced, stored in `expo-secure-store`/`AsyncStorage`): `appLockEnabled`, `serverUrl`,
`deviceId`, tokens, last sync cursor.

**Account**

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string 1–60 | |
| `type` | `cash \| checking \| debit_card \| credit_card \| savings \| investment \| pocket` | Labels: Contanti, Conto, Carta di debito, Carta di credito, Risparmi, Investimenti. A debit card is its own account with its own balance, and behaves like `checking`. A `pocket` is a goal (D24, §5.14): it is never offered in the account type grid and is created only by the goal wizard. |
| `institution` | string ≤60 \| null | Shown as subtitle ("Intesa Sanpaolo"). |
| `openingBalance` | minor int | Balance at creation (may be negative for credit cards). |
| `includeInSpendable` | boolean | Default `true` for cash/checking/debit_card/credit_card, `false` for savings/investment. |
| `colorIndex` | int 0–23 | Index into `categoryColors`. |
| `icon` | IconName | Options: landmark, card, coins, piggy, trend, phone, briefcase, shield. |
| `creditCloseDay` / `creditChargeDay` | int 1–28 \| null | Only for `credit_card`. |
| `creditPaymentAccountId` | id \| null | Account the card is charged to. |
| `archivedAt` | ISO \| null | Archived accounts are hidden from pickers and totals; history stays. |
| `parentAccountId` | id \| null | Required iff `pocket`: the real account the pocket's money sits in. The parent is `cash`, `checking`, `debit_card` or `savings`, not archived, and never itself a pocket. It cannot change after creation. |
| `goalTarget` | minor int > 0 \| null | Required iff `pocket`. |
| `goalDeadline` | LocalDate \| null | `pocket` only. Optional: a goal without a deadline has no pace (§5.14). |
| `goalStartDate` | LocalDate \| null | Required iff `pocket`: the day the goal was created, the origin of its pace. |
| `sortOrder` | int | |

**Category**

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string 1–40 | |
| `direction` | `expense \| income` | |
| `parentId` | id \| null | **One level only**: a child cannot have children, and a parent's direction must match. |
| `icon` | IconName | Picker groups in §6.13. |
| `colorIndex` | int 0–23 | |
| `archivedAt` | ISO \| null | |
| `sortOrder` | int | Manual reorder ("Riordina"). |

**Tag**: `name` string 1–40, unique case-insensitive among non-deleted tags.

**Transaction**

| Field | Type | Rules |
| --- | --- | --- |
| `kind` | `expense \| income \| transfer` | |
| `amount` | minor int > 0 | Always positive; `kind` gives direction. |
| `date` | LocalDate | |
| `accountId` | id | Source account. |
| `toAccountId` | id \| null | Required iff `transfer`, must differ from `accountId`. |
| `categoryId` | id \| null | Required iff `expense`/`income`, direction must match kind; `null` for transfers. |
| `description` | string ≤120 | Empty → UI shows category name (or "A → B" for transfers). |
| `note` | string ≤1000 \| null | |
| `tagIds` | id[] | |
| `excludeFromTotals` | boolean | Still moves account balances; ignored by stats and budgets. |
| `recurrenceId` | id \| null | Set on occurrences generated from a recurrence. |

**Recurrence**

| Field | Type | Rules |
| --- | --- | --- |
| `frequency` | `daily \| weekly \| monthly \| yearly` | With `interval`: every N units. Rows written when only `monthly` existed still parse. |
| `interval` | int 1–99 | Defaults to 1 on parse. |
| `startDate` | LocalDate | The anchor: day of month for monthly and yearly (clamped to the month length), weekday for weekly. |
| `endDate` | LocalDate \| null | Inclusive. "Dopo N volte" is stored as the date of the N-th occurrence. |
| `template` | object | `{ kind, amount, accountId, toAccountId, categoryId, description, tagIds, excludeFromTotals }`. |

**Budget**

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string 1–40 | Default auto-name: 1 cat → name, 2 → "A e B" / "A and B", 3+ → "A +2". |
| `categoryIds` | id[] ≥1 | Expense categories. A parent id includes its children. A category may belong to **at most one** budget. |
| `amount` | minor int > 0 | Limit per period. |
| `period` | `period \| week \| month \| year` | Labels: Ogni periodo, Settimana, Mese, Anno. `period` follows the app's own period whatever kind it is (§5.2), which is what the old `cycle` value meant. The other three are **absolute** windows, so a monthly budget inside a pay cycle measures the calendar month and disagrees with the period total on purpose — that is the point of choosing it. |
| `alertThreshold` | int 1–100 \| null | Percent of the limit. null = "Mai". The "Avvisami a" control offers `BUDGET_ALERT_THRESHOLDS` (75/90/100), but the stored value is any percentage: the alert rule (§5.8) is arithmetic, and pinning the three UI options into a synced row would make a slider a migration. |
| `rollover` | boolean | "Porta avanti il residuo". |
| `icon` | IconName | Default: icon of first category. |
| `sortOrder` | int | |

**Attachment**

| Field | Type | Rules |
| --- | --- | --- |
| `transactionId` | id | |
| `mimeType` | `image/jpeg \| image/png \| application/pdf` | HEIC is converted to JPEG on device. |
| `byteSize` | int ≤ 10 485 760 | |
| `sha256` | hex string (64) | Integrity check on upload/download. |
| `width` / `height` | int \| null | Images only. |

Local-only columns on the attachment table: `localUri`, `blobState` (`local_only | uploading | synced | remote_only | failed`).

### 4.2 Seed data (onboarding step 3)

Seeds are created in the user's language at onboarding. After that, names are ordinary user data.

| it | en | direction | icon | colorIndex | children (it/en, icon, color) |
| --- | --- | --- | --- | --- | --- |
| Spesa | Groceries | expense | cart | 0 | Supermercato/Supermarket cart 0; Panetteria/Bakery apple 1 |
| Casa | Home | expense | house | 1 | Affitto/Rent key 1; Manutenzione/Maintenance wrench 2 |
| Trasporti | Transport | expense | train | 2 | Carburante/Fuel fuel 2; Mezzi pubblici/Public transport bus 3 |
| Utenze | Utilities | expense | zap | 3 | |
| Ristoranti | Restaurants | expense | utensils | 4 | |
| Salute | Health | expense | heart | 5 | |
| Sport | Sport | expense | dumbbell | 6 | |
| Shopping | Shopping | expense | bag | 7 | |
| Tempo libero | Leisure | expense | film | 8 | |
| Abbonamenti | Subscriptions | expense | monitor | 9 | |
| Formazione | Education | expense | cap | 6 | |
| Stipendio | Salary | income | landmark | 5 | |
| Rimborsi | Refunds | income | arrowDL | 3 | |
| Regali | Gifts | income | gift | 7 | |

Onboarding step 3 shows the 12 top-level entries from the design's `ONB_CATS` (the 11 expense rows + Stipendio). All are
selected by default. Unselected entries are not created. Rimborsi and Regali are always created (hidden from the
picker to keep the grid at 12). Children are created together with their selected parent.

---

## 5. Domain rules & formulas (implemented in `@saldo/core`)

### 5.1 Money

- Stored in minor units. The amount buffer uses `.` internally whatever the device shows (D23).
- **Input is Saldo's own keypad** (D23), not the device's: three digit columns, `⌫` and a tall action key
  («Fatto», «Continua» on an onboarding step), plus a `−` key on a field that allows one. `pressAmountKey(buffer, key,
  minorDigits, { allowNegative })` applies one press; `sanitizeAmountInput(text, minorDigits)` normalises whatever
  arrives as text instead (a hardware keyboard, a paste, an import). Both enforce the same limits: only the first
  separator counts as the decimal point, anything that is not a digit or separator is dropped, leading zeros go while a
  lone `0` stays, and max **8 significant digits** split by the currency scale — `maxIntegerDigits = 8 − minorDigits`,
  so 6 + 2 for EUR, 8 + 0 for JPY, 5 + 3 for KWD. A 0-decimal currency gets no separator key and no fractional part at
  all. The separator on the key is the app language's (`,` in Italian, `.` in English); the buffer always stores `.`.
- The field shows the raw buffer while typing, not a grouped number: re-formatting text under the caret fights the
  user. Grouping applies wherever an amount is *displayed*.
- **Balances can be negative** (account sheet §6.22, onboarding step 3); transaction and budget amounts cannot. A balance
  field opts in with `allowNegative`: the buffer carries a leading `-` (a lone `-` reads as 0) and the sign is drawn
  **in front of the digits** as a tile that both reads the state and toggles it — a faint `+` that becomes a
  full-weight `−` — so the sign is legible and changeable with the keypad closed. The tile is the `switch`
  ("Negativo", checked when negative) that assistive technology drives and that calls `toggleAmountBufferSign`; the
  keypad's `−` key is the same action for the typing thumb and is hidden from the accessibility tree, so there is never
  more than one switch by that name. The digits themselves never carry the sign, so they do not shift when it flips,
  and the field reads its value to a screen reader with the `−` in place. `sanitizeAmountInput` still keeps a `-` or
  `−` that arrives as text, and `minorToAmountBuffer` keeps the sign, so editing a credit card below zero keeps it
  below zero.
- Display: `formatMoneyParts` returns `{ sign, integer, fraction, decimalSeparator, symbol, symbolPosition }`.
  The design renders the fraction and symbol at **50% opacity** (`1.842<span opacity .5>,60 €</span>`).
  - it: group `.`, decimal `,`, symbol suffix with a space (`1.842,60 €`).
  - en: group `,`, decimal `.`, symbol prefix (`€1,842.60`; multi-letter symbols get a space: `CHF 1,842.60`).
  - Negative sign is U+2212 `−`. Income rows show a `+` prefix.
- Changing currency never converts (§1.2). Confirm sheet copy: "Gli importi vengono riformattati, non convertiti."
  Switching between currencies with a *different* `minorDigits` **keeps the stored integers untouched**: `184260` reads
  as `1.842,60 €` and as `184.260 ¥`. Rationale: re-scaling the stored amounts to preserve the displayed number
  (`184260` @2 → `1843` @0) is lossy and irreversible — it discards the minor unit on every row, so EUR → JPY → EUR
  returns `184300`, and it buys no correctness anyway (the FX value is nowhere near either number). Keeping the integers
  is a no-op migration and fully reversible. When the scales differ the confirm sheet states the effect with a concrete
  example built from the user's own total: "1.842,60 € diventerà 184.260 ¥. Gli importi vengono riformattati, non
  convertiti." Users who genuinely need two currencies want per-account currencies (§1.2), not this switch.

### 5.2 Periods

The period is **how the user tracks spending**, not a fixed pay cycle. `settings.periodKind` picks one of four kinds,
and `PeriodDef = { kind, startDay }` is what every calculation takes (`@saldo/core/period.ts`):

| Kind | Range | Steps by |
| --- | --- | --- |
| `month` (default) | the 1st to the last day of the calendar month | one month |
| `week` | Monday to Sunday (ISO) | seven days |
| `cycle` | `startDay` to the day before the next `startDay` | one cycle, clamped per month |
| `year` | 1 January to 31 December | one year |

`month` is the default because it needs no decision; `cycle` is the only kind that asks a second question, so
onboarding step 1 reveals its day grid only when it is chosen. Everything downstream takes a `DateRange` and does not
care which kind produced it, which is why `summarizePeriod`, `spendingByCategory`, `dailyCumulative`, `committedSpend`
and the projections are shared by all four.

Stepping is always **by definition, never by day arithmetic**: a month is not 30 days, and a cycle starting on the 28th
starts earlier than "31 days back" in February.

The pay cycle keeps its own rule:

- `cycleStartDay` S ∈ 1..28 (the UI offers no more; a start day of 29–31 has no meaning in February). The **effective
  start day** in a month is `min(S, daysInMonth)`.
- `cycleContaining(date, S)`: if `date ≥ effectiveStart(month of date)`, the cycle starts in that month, otherwise in the
  previous month. The end is the day before the next cycle's effective start.
  - Example S=27: `2026-04-18` → `2026-03-27 … 2026-04-26` (31 days).
  - Example S=31: `2026-03-30` → `2026-02-28 … 2026-03-30`.
- `elapsedDays(cycle, today)`: 0 before start, `length` after end, otherwise `diff(start, today) + 1`.
- `pace = elapsed / length`. The **pace marker** is the 1px vertical tick on every progress bar at `pace × 100%`.
- Period navigation (`‹ ›` on Home) moves one period back or forward, by the kind in force. Forward is disabled (faint
  colour) on the current period.
- Custom period ("Periodo personalizzato"): an arbitrary `{start,end}` range. For a custom range, `pace` uses the same
  formula with that range, and projections are hidden.
- Changing the kind or `cycleStartDay` only regroups transactions. Nothing moves (settings footnote copy). The
  selection falls back to the period containing today, because a range of the previous shape is no longer a period.

### 5.3 What counts

Let `today = todayLocal()`.

- **Upcoming (scheduled):** `date > today`. Shown in "In arrivo" and in lists with a 2px left border and muted amount.
- **Counts in totals:** `kind ≠ transfer && !excludeFromTotals && date ≤ today`.
- **Income / spent (cycle):** sum of counted `income` / `expense` amounts in the range.
- **Remaining:** `income − spent`. Label "Rimasto da spendere" (current cycle) or "Avanzato nel ciclo" (past).
- **Home bar:** width `min(spent/income, 1)`, accent colour if `spent/income > pace`, grey otherwise.
- **Account balance:** `openingBalance + Σ income(account) − Σ expense(account) − Σ transfers out + Σ transfers in`,
  over **all** non-deleted transactions with `date ≤ today`. `excludeFromTotals` still affects balances.
- **Totale spendibile:** Σ balances of non-archived accounts with `includeInSpendable`.
  **Patrimonio complessivo:** Σ balances of all non-archived accounts.
- **Credit card:** balance is usually negative; the detail shows "Da rimborsare" with the absolute value. "Maturato nel
  ciclo di fatturazione" = Σ expenses on the card since the last `creditCloseDay`. "Prossimo addebito" = next
  `creditChargeDay` after today.
  - **Statement due** (`creditStatementDue`): the card's debt on the last close day (the close day belongs to the
    statement it closes; 0 if the card was in credit), minus the transfers into the card dated after the close and up
    to the later of the charge date and the day before the next close — so an early, a late and a scheduled payment
    all count. Refunds and spending after the close go to the next statement, but the amount due never exceeds what
    the whole card owes today. No close day → no statement. The model does not change: a payment is a transfer from
    the payment account, never an expense, and the card is never clamped at 0 or charged automatically.
  - **Charge-day reminder:** a local notification (`expo-notifications`, same permission flow as the budget alerts
    of §5.8) at **09:00** on the statement's charge date: "Carta {name}: {amount} da saldare oggi" (the amount
    follows hidden mode). One per card (`card-charge:{id}`), rescheduled whenever the cards or transactions change;
    none when the statement is paid, the charge day has passed or the card has no charge day. Tapping it opens the
    card detail (`creditChargeReminders`).

### 5.4 Categories in aggregates

- `spendingByCategory(range)` → Map `categoryId → amount` over counted expenses (`income` variant for income).
- `rollupToParents` merges children into their parent. Splits, budgets and Home use parent-level totals. Category
  detail shows the children breakdown ("Sottocategorie": **every live child, whether it spent or not**, plus any
  archived child that still spent in the period, sorted by amount desc; transactions directly on the parent appear as
  "Senza sottocategoria"). The card is hidden only when the category has no children at all.
  - *Was "only when ≥2 children have spend".* That is the right rule for a split — one segment is not a split — but
    this card is also the **only way to reach a subcategory**: "Ripartizione" rolls it into its parent and the
    Categorie list names it without linking it. Under the old rule a parent with one spending child hid that child
    from every screen, and the only route left to it was opening one of its own transactions.
- Split bar ("Ripartizione"): all parents sorted by amount desc, with each segment coloured by `categoryColors[colorIndex]`.
  Home/Tag views that show a limited list use the top 5 plus an "Altre categorie" segment coloured `segmentOther`.

### 5.5 Historical baselines

- **History window:** the 6 cycles before the selected cycle (skip cycles that have no transactions at all).
- **Category median:** median of the category's parent-level spend across the window. **Delta vs usual:**
  `round((current − median)/median × 100)` %, or `null` → label "nuova"/"new" if there's no history.
- **Cycle median:** median of total `spent` across the window (used by the projection).
- **Budget amount suggestion** ("Mediana degli ultimi 6 cicli … [Usa]"): median over the window of Σ spend of the
  selected categories.

### 5.6 Home "Andamento del ciclo" chart

- `current[i]` = cumulative counted expenses from cycle start through day `i`, for `i < elapsed`.
- `usual` = the average of the cumulative series of the **previous 3 cycles**, each resampled to the current length
  with `resample(series, len)[i] = series[round(i × (series.length−1)/(len−1))]`.
- Header right: `current[last]`. Floating label: `(diff ≥ 0 ? "+" : "−") |diff| rispetto al solito`, accent if above
  usual, positive colour if below. Footer: `Giorno {elapsed} di {length} · media dei 3 cicli precedenti in grigio`.
- Rendering: SVG polyline, grey `usual` (1.5px `borderStrong`), accent `current` (2px), and a 3px accent dot at the last point.

### 5.7 Statistics

- **Cashflow (6 columns):** for each of the last 6 cycles including the selected one, show counted income (bar up, positive
  colour) and expenses (bar down, accent), with the net label above (`+123` muted, or `−123` accent, rounded to units).
  The running period's bars are hatched (45° stripes); a closed period the user navigated to is not, its totals are final.
  **When the selected period is the current one** and the forecast of §5.17 exists, the six columns become the two
  closed periods before it, the current one and the **three forecast periods** (D29): dimmed (50% opacity) and hatched,
  a min–max band behind each forecast expense bar, a dashed divider before the first, and the caption «3 periodi · 3
  previsti». Under the chart one row, «Al {data} circa {saldo} ›», opens the forecast sheet (§5.17). A custom range, a
  closed period or a period ahead keep the six historical columns: going further back is the header's ‹, not a
  scroll inside the chart. Navigation stops at the current period everywhere (§6.15), so no whole period ahead is ever
  selected.
- **Quota impegnata (committed share):** `committed` = counted expenses with `recurrenceId ≠ null`.
  `discretionary = max(0, spent − committed)`. Two bars (grey committed, accent discretionary) and the line
  "Il {pct}% di questo ciclo era già deciso in partenza: {committed} tra affitto, utenze e abbonamenti."
- **Proiezione di fine ciclo** (only for the current cycle with `daysLeft ≥ 3`):
  `projection = spent + (discretionary / elapsed) × daysLeft + upcomingScheduled`, where
  `upcomingScheduled` = Σ expenses in range with `date > today` and `!excludeFromTotals`.
  Line: "Circa {|projection − cycleMedian|} {sym} sopra/sotto il solito, mantenendo questo ritmo." (rounded to units).
  Hide the line if there's no cycle median.
- **Ripartizione:** Uscite/Entrate toggle, total, split bar, rows with colour dot, name, delta vs usual, % of total, amount.
  Tapping a row opens category detail. A trailing row "N transazioni escluse dai totali · amount" opens the transaction
  list filtered to excluded (`onlyExcluded`) for that direction.
- **Tag:** a **ranking** of the cycle's tagged rows by expense (then income) — tag name, "N transazioni", the spend and,
  when the tag carries income, that income signed beneath it (never subtracted, as in §5.10); a tag with income only
  shows just that. The header caption reads "Uscite" or, once a row carries income, "Uscite · entrate". Top 5, then "Tutti i tag"
  → the tag list. Tapping a tag opens the tag view (all dates, §5.10). Below it, "N voci senza tag · {amount}" and, from
  two tags up, the note that a transaction with several tags counts in each.
  **Never a split bar, a pie or a % of total:** tags are neither exclusive nor exhaustive, so the amounts overshoot the
  cycle's spend and still miss the untagged rows. `tagTotals` returns the untagged spend precisely so the card can
  say what it leaves out. This is the *reading* entry point for tags; the one in Profilo is for *managing* them
  (rename, merge, delete), and a trip four taps deep inside the settings was a trip nobody found.
- **Category detail:** total, delta line, "Ultimi 6 cicli" bars (5 previous + current in accent), median label,
  "Media 6 cicli", sub-category split, and cycle transactions sorted by amount desc.

### 5.8 Budgets

- **Range:** `period` → the selected period; `week`/`month`/`year` → the ISO week (Mon–Sun), calendar month or
  calendar year containing the reference day, which is `today` while the period is current and the period's end once
  it is closed. Those three are **not** clipped to the period: an annual budget browsed from a past month still
  measures that whole year. The one exception is the week of a closed period, which becomes that period's last week,
  clipped to it — "this week" has no meaning once the period is over.
- **Progress:** `spent` = Σ counted expenses in range for expanded category ids. `ratio = spent/limit`,
  `overPace = ratio > pace(range)`, `overLimit = ratio > 1` (amount turns accent).
- **Rollover** (`period` only): `effectiveLimit = amount + carry`, `carry = max(0, prevEffectiveLimit − prevSpent)`
  computed recursively back to the period the budget was created in. For week/month/year, rollover is ignored and the
  toggle is hidden: a carry between two windows of a different shape than the period has no defined meaning.
- **Home card:** a target card (§5.13, D25). With **no budgets** the card stays, reduced to its header with the note
  `"Nessun budget"` and the row «Crea un budget»: it is the way into §6.4, and hiding it left the budget list — and the
  wizard behind it — unreachable on a fresh install.
- **Alerts:** when a write makes `ratio × 100` cross `alertThreshold` (from below), schedule an immediate **local
  notification** (`expo-notifications`): "Budget {name}: {pct}% usato". Notify once per budget per period (remember
  `lastAlertPeriodStart` device-locally).
- **Category taken rule:** in the new-budget grid, categories already in another budget show a dot and can't be picked
  (toast "«X» è già in un altro budget").
- **Budget detail sheet:** spent, "su {limit}", bar with pace tick, "Periodi precedenti" 6 bars (5 previous + current
  in accent), "Media 6 periodi".

### 5.9 Recurring transactions

- The "Ripeti" chip row of the new-transaction sheet (Mai / Ogni mese / Ogni settimana / Altro › sheet with presets,
  "Personalizzato" every N days/weeks/months/years, and an end: mai / in una data / dopo N volte) creates a
  `Recurrence` whose `startDate` is the transaction date, plus the first occurrence (id = `${recurrenceId}:${date}`).
- **"Ripeti" on an existing transaction** (the same chip row in the edit form) replaces the row with that first
  occurrence, because the id has to be the deterministic one (D21). Two things travel with it: its **attachments**,
  repointed at the new id, and the **screens** showing the old one — the detail underneath the editor is taken to
  the new id instead of being gone back to, otherwise it renders as a row that no longer exists.
- **Materialiser** (`materializeOccurrences(recurrence, existingIds, horizonEnd)`): for each date the schedule fires
  on (`nthOccurrence`) from `startDate` to `min(endDate, horizonEnd)`, if no row with the deterministic id exists
  (including tombstones), create it from the template. `horizonEnd = end of the cycle after the current one`. It runs
  on app start, on foreground, after sync pull, and after any recurrence write.
- **Edit scope sheet** ("Questa voce è ricorrente") appears when saving an edited occurrence:
  - *Solo questa:* update just this transaction row.
  - *Questa e le successive:* set old `recurrence.endDate = occurrenceDate − 1 day`, tombstone old occurrences with
    `date ≥ occurrenceDate` that are upcoming (`date > today`) or equal to this one, create a new Recurrence from this
    date with the edited template, and materialise.
  - *Tutte le occorrenze:* update the template and every existing occurrence (past included), keeping each occurrence's
    own date.
  - Notes in the sheet use real counts: "Le altre {n} restano invariate", "le {n} occorrenze future già programmate",
    "tutte e {n} le occorrenze".
- **Deleting** an occurrence tombstones only that occurrence (dialog copy for recurring items), so the materialiser won't
  recreate it because the tombstone keeps the id.
- **Stopping** ("Smetti di ripetere", from the recurrence detail): `endDate = today`, every occurrence dated after
  today is tombstoned, today's stays. A series whose `startDate` is still ahead is tombstoned whole.
- **Changing the rule** from the detail: same cadence → only `endDate` moves (rows past it go, the materialiser
  extends if it grew). New cadence → the old series ends today, its upcoming occurrences go, and a new recurrence with
  the same template starts on the first date the new rule fires after today, anchored on the old `startDate`.
  Template edits keep going through the scope sheet from an occurrence.

### 5.10 Tags

- Created inline from the transaction sheet's tag field ("Crea «X»"), or with "+" on the tag admin, which opens the "Nuovo tag" sheet, for a
  tag made before the transactions that will carry it. Names are unique case-insensitively, on create and on rename.
  The list is sorted by usage count desc.
- **Rename:** update `Tag.name` (ids unchanged).
- **Merge into another tag:** replace the source id with the target id in every transaction's `tagIds` (dedupe), then tombstone
  the source.
- **Delete:** remove the id from all transactions, then tombstone. Confirm inline: "Eliminare «X»? Le transazioni restano."
- **Tag view:** a tag spans all dates (the period selector doesn't apply). Shows two figures side by side, «Totale
  uscite» and «Totale entrate» — counted rows only, like the split, and **never netted**: a refund on a trip is the tag's
  whole point, but a tag used for two unrelated things would net them, and a net would no longer match the category
  split, which can only split expenses. Transfers count on neither side. Then the line "Tutte le date,
  fuori dal periodo selezionato", "N transazioni · first – last date", split by category, and all transactions ascending
  by date. The scope line is not decoration: the screen is reached from a card that *is* scoped to one cycle (§5.7), and
  two totals that disagree without saying why read as a bug.
- **Reached from:** the Tag card on Statistiche, a tag chip on a transaction, or Profilo → Gestisci i tag.
- Transactions list: when a tag filter is active, rows show their tags joined by " · ".

### 5.11 Categories admin

- Sections Uscite / Entrate, children indented (32px, 26px icon box, 13px text), with usage count "N voci".
- "Riordina" toggles drag handles (`react-native-reorderable-list` or `react-native-draggable-flatlist`). Reorder
  within a sibling group only.
- **Delete is not offered.** Archive sheet: "Questa categoria non si può eliminare · N transazioni usano questa
  categoria". Optional "Sposta le transazioni in" target (same direction, not self). Confirm "Sposta e archivia" /
  "Archivia". Moving rewrites `categoryId` on affected transactions (and budgets' `categoryIds`). A category with
  0 uses can be archived directly. Archived categories are listed under "Archiviate" with "Ripristina".
- The category form has a "Budget mensile" toggle + amount. On save, it creates or updates a single-category `cycle` budget.

### 5.12 Transactions list behaviour

- Groups by day desc; sticky day header with day expense total (counted, non-excluded).
- Search matches description, category name and account name: case-insensitive and accent-insensitive.
- Chips: Conto (picker), Categoria (picker), Tag (multi-select sheet), Solo uscite, Solo entrate, and "Solo escluse"
  when active. **Transfers match neither direction chip**: they move money between the user's own accounts and §5.3
  keeps them out of every total, so "Solo uscite" shows real spending only. They stay visible with no direction filter,
  and the Conto chip still matches both legs. In the POC, Conto/Categoria open pickers (a bottom sheet list) rather than cycling as in the prototype.
- **Filtered total:** with any filter on, one line above the list — "N voci · {expenses} di uscite" (plus
  ", {income} di entrate" when the filtered rows contain any). It sums `totalsOf(settled)`, which counts rows flagged
  `excludeFromTotals` **on purpose**: "Solo escluse" exists, and a total that answers 0 for the rows on screen reads as
  a bug. Transfers count towards N but land in neither amount. This is how a tag is measured inside the current cycle;
  the all-dates figure is the tag view (§5.10).
- **Tag chip label:** one selected tag shows its name, several show "N tag", none shows "Tag" — the total below it is
  meaningless if the chip cannot say what it is a total *of*.
- **Swipe row:** drag right > 70px → edit; drag left > 70px → delete dialog; max travel 120px; release below threshold
  snaps back (240ms, easing `cubic-bezier(0.32,0.72,0,1)`); tap (< 5px) → detail. Background reveals "Modifica"
  (left) and "Elimina" (right, accent), with opacity `min(1, |dx|/70)`. Use Reanimated + Gesture Handler.
- **Delete:** dialog → tombstone → toast "Eliminata «X»" with "Annulla" for 5s (undo clears `deletedAt`).
- **Empty states:** with filters → "Nessun risultato" + "Azzera filtri"; without → "Nessuna transazione" +
  "Nuova transazione".

### 5.13 Target cards (Home: Budget and Obiettivi)

One card shape for everything on Home that has a target (D25). A budget is a **ceiling** and a goal is a **target to
reach**, so a full bar means opposite things. The card therefore never lets fullness carry meaning: colour does.
**`accent` = needs attention** (a budget over pace or over its limit, a goal behind or past its deadline), **`positive`
= a goal reached** — the only place green appears — and `barGrey` for everything else, "ahead" and "in line" included.

**Structure, top to bottom.**

1. **Header:** title and status line, **not pressable** and without a chevron. The card has one action, and it is the
   last row. Status: budgets `"{n} oltre il limite"`, else `"{n} oltre il ritmo"`, else `"nei limiti"`; goals up to two
   of `"{n} scaduti"`, `"{n} indietro"`, `"{n} raggiunti"`, in that order, else `"nei tempi"`. `accent` when anything
   needs attention, muted otherwise.
2. **Featured item** (one, always, while the card has any item): icon, name and a short meta on one line; the big
   figure (`amountLg`, fraction and symbol at 50%) is **what fills the bar** — spent for a budget, saved for a goal —
   under it `"di {limit} · {pct}%"`; an 8pt bar with the pace tick and three labels under it (range start, `oggi` at
   the tick, range end; an end label drops out when `oggi` is within 22% of it, the start within 18%, and a reached or
   expired goal shows no `oggi`); then **the sentence**, its action at weight 500 and its state muted:
   - budget, within limit: «Puoi spendere ancora **{left ÷ daysLeft} al giorno** fino al {end}. Sei {gap} {oltre |
     sotto} il ritmo.» `daysLeft` counts today and the range's last day; the amount per day is rounded **down**, since
     it is a ceiling and rounding up would let the last day overshoot.
   - budget, over limit: «Hai superato il limite di **{overrun}**. Ogni altra spesa in {name} si aggiunge, fino al
     {end}.»
   - budget, range closed (a past period): «Periodo chiuso a {pct}% del limite.»
   - goal sentences: §5.14.
3. **Event rows**, at most **3**: the exceptions that must not hide behind a tap. Budgets: over their **limit**, by
   overrun in money, desc. Goals: expired, then reached (most recently reached first). Over-*pace* is not an event.
   Each row: a 36pt ring with the icon inside, name, meta, and on the right `{pct}%` over the status in its tone.
4. **«Tutti …» row**, the card's only action (→ §6.4 / §6.35): a 28pt ring per remaining item (sort order), then
   `"Tutti i budget · {n}"` / `"Tutti gli obiettivi · {n}"`, where `n` is the total count, and a chevron. With nothing
   left to preview it shows the label alone.

**Rings** carry progress (`ratio`, clamped to 1), the pace tick on the circle, and the icon in the centre in the
item's colour; they are the icon box of a row with a target. They are decorative for assistive technology: the row's
label says everything.

**Which item is featured** (`featuredTarget` in `@saldo/core`, pure, taking the previous featured id):

| Card | Tiers, highest first, and the score that ranks inside a tier |
| --- | --- |
| Budget | over limit (overrun, money) → over pace (`ratio − pace`) → the rest (`ratio ÷ pace`, closest to pace first) |
| Obiettivi | expired (missing, money) → behind (`−gap ÷ target`) → in line with a deadline (smallest `gap ÷ target`) → no deadline (lowest `ratio`) → all reached: the most recently reached |

**Hysteresis**, so the card does not change face at every transaction: a candidate in a **higher** tier replaces the
previous item at once; in the **same** tier it replaces it only when its score beats the previous one's by 5% of the
previous item's limit or target; a previous item that no longer exists, is archived, or (a goal) is reached is
replaced. The previous featured id is remembered **device-locally**, per card.

- The Budget card follows the period selected on Home. **The Obiettivi card always reads today**: a goal is not a
  period aggregate.
- **Hidden mode leaves the Home target cards alone**, as it left the Home budget card since the third device check of
  hidden mode (2026-09-22): on Home only «Rimasto da spendere» hides. The goal list and detail (§6.35, §6.36) follow the
  aggregate rule like any balance.
- **Motion:** nothing animates in beyond Home's card entrance: Home is opened tens of times a day. A **change of
  value** animates — the featured bar (`ProgressBar`, `scaleX`) and every ring (`strokeDashoffset` through
  `useAnimatedProps`, on the UI thread, no layout) move from the old value to the new one, `motion.progressMs` with the
  shared easing, interruptible, instant under Reduce Motion. The pace tick and a change of featured item do not
  animate. Rows keep the usual press feedback.
- **Taps:** the featured item and an event row open the item (budget detail sheet §6.17, goal detail §6.36).

### 5.14 Goals and pockets

A goal is a **pocket** (D24): an account of type `pocket` inside a parent account, with a target and an optional
deadline. Example: «Macchina, 12.000 € entro giugno 2027» inside «Conto corrente».

**Money.**

- `saved` = the pocket's balance (§5.3). Money goes in and out **only by transfers** — «Accantona» (parent → pocket)
  and «Preleva» (pocket → parent), each opening the new-transaction sheet prefilled — or by an expense recorded from
  the pocket. A recurring transfer into the pocket is an automatic contribution.
- A pocket is created with `openingBalance = 0` and `includeInSpendable = false`, always. What the user already has
  aside («Già da parte») becomes a **transfer from the parent** dated on creation: an opening balance would count the
  same money twice in Patrimonio complessivo.
- **Totale spendibile and Patrimonio complessivo do not change**: the transfer already moved the money out of the
  parent's balance and into an account that is not spendable. «Rimasto da spendere» does not change either: transfers
  are not counted (§5.3).
- **The parent reads like the bank.** Wherever an account with pockets shows a balance, it shows the **bank balance** =
  its own balance + its non-archived pockets' balances. In Conti (§6.5) its pockets are listed indented under it,
  each with its ring, and a last line «liberi» carries the own balance — the part that is actually spendable.
  Its detail (§6.10) shows the bank balance too, and an «Obiettivi» card lists its goals the same way — ring, name,
  balance, each opening its goal — with the «liberi» line last.

**Progress** (`goalProgress` in `@saldo/core`, with injected `today`):

- `reached` = `saved ≥ goalTarget`. `reachedOn` = the first day of the latest run of days with the balance at or above
  the target, computed from the ledger and never stored.
- `expired` = a deadline before today and not reached.
- **Pace**, only with a deadline: `pace = elapsedDays(goalStartDate … goalDeadline, today) ÷ length` (§5.2);
  `startSaved` = the balance at the end of `goalStartDate`; `expected = startSaved + (goalTarget − startSaved) × pace`;
  `gap = saved − expected`. Starting from `startSaved` keeps a goal created with money already aside from reading as far
  ahead. **Behind** means `gap < −allowance`, where `allowance = (goalTarget − startSaved) ÷ periods from the start to
  the deadline` — one period's share of the plan: a goal is never behind the day it is created, nor between two monthly
  contributions (decided 2026-09-24, after review).
- **Per period**: `periodsLeft` = the number of app periods (`settings.periodKind`, §5.2) from the one containing today
  to the one containing the deadline, both included; `perPeriod = ⌈(goalTarget − saved) ÷ periodsLeft⌉` in minor
  units, rounded **up** so that following the advice reaches the target.

**Sentences** (featured item, goal detail, list):

| State | Sentence |
| --- | --- |
| deadline, `periodsLeft > 1` | «Metti da parte **{perPeriod} {al mese \| a settimana \| a ciclo \| all'anno}** per arrivarci. Sei {gap} {indietro \| avanti}.» |
| deadline in the current period | «Mancano **{missing} in {n} giorni**.» |
| no deadline | «Mancano **{missing}**.» |
| expired | «Scaduto il {deadline}: mancano **{missing}**. Sposta la scadenza o chiudilo.» |
| reached | «Hai messo da parte **{goalTarget}**. Chiudilo quando usi i soldi.» |

**Closing a goal** («Chiudi obiettivo», goal detail, and the reached event row): the close sheet (§6.38) asks what
happened to the money. Closing first **stops every recurrence in or out of the pocket and removes every row dated after
today** that touches it, then brings the pocket to **exactly zero** in both directions: what is left returns to the
parent, and a pocket that spent more than it held is topped up from it. «Registra la spesa» opens the new-transaction sheet prefilled — an expense from the pocket, the
whole balance, the goal's name as description — as «Salda carta» does (§6.10), nothing written until it is saved.
Saving records the expense and closes the goal **in one transaction**; the expense is always from the pocket, dated
today at the latest and never repeating, whatever the sheet was changed to.
«Riporta in {parent}» writes a transfer of the whole balance back to the parent. Whatever is left after the expense is
returned the same way. Then the pocket is **archived**. **An archived pocket always has a zero balance**, so archiving
never hides money from the totals. Its rows become **read-only** (edit and delete are refused), so nothing can change
that balance afterwards. Restoring it (Ripristina, on the goals screen) reopens the goal empty with its pace starting
**today** and a deadline that has passed dropped; it is refused while the parent is archived.

**Rules around pockets.**

- Editing a goal changes name, target, deadline, icon and colour; never the parent. An expired goal can be renamed
  without moving its deadline.
- An account holding open goals can only change to another type that can hold them (cash, checking, debit card,
  savings).
- Archiving a parent that still holds open pockets is refused with «Chiudi prima gli obiettivi in questo conto».
- Pockets are **not** offered in the account chips of the new-transaction sheet (§6.16); they appear in the transfer
  pickers grouped under their parent, and prefilled by the goal's own actions. A credit card cannot be charged to a
  pocket (`creditPaymentAccountId`).
- CSV import (§11.3) never maps a row to a pocket; CSV export and the JSON backup include pockets like any account.
- **Notification:** when a write makes a goal reached, one local notification — «Obiettivo {name} raggiunto: {goalTarget}»
  (the amount follows hidden mode) — with the same permission flow as the budget alerts (§5.8). Once per goal,
  remembered device-locally.
- **Sync:** `account.type` gains `pocket` and the account gains four nullable fields. Saldo has no public build yet, so
  `SYNC_SCHEMA_VERSION` does not move, as with `settings.language` (§4.1).

### 5.15 Period recap

When a period closes, the first open of the app shows a recap of it — a full-screen sheet over the Home of the new
period (§6.39) — and only then the Home (D27). Today the switch is otherwise silent: at midnight Home, budgets and
stats move to the new period.

**When.**

- On the first open **on or after the first day of a new period**, for **every kind** (§5.2: month, week, cycle, year),
  the week included. Once per period: the period recapped is remembered **device-locally** in `kv` as
  `lastRecapPeriod = "{kind}:{start}"`, like the budget alerts' `lastAlertPeriodStart` (§5.8). It is marked when the
  sheet is shown, so closing the app with the sheet open does not show it again.
- The period recapped is **the one immediately before the period containing today**, under the kind in force. Only that
  one: after weeks without opening the app there is still a single recap, of the last period that closed.
- **No recap** when that period has no transaction at all (a fresh install, the same emptiness rule as §5.5), when
  its key is already the stored one, or when onboarding was completed during the current period
  (`settings.onboardingCompletedAt` on or after its start): an imported history must not greet a new user with a
  recap of a period they never lived in Saldo. A change of kind or of `cycleStartDay` gives a new key, so the previous period of
  the new shape may be recapped once; nothing else follows from it.
- **Seen once.** Once dismissed, the recap cannot be reopened: there is no Home card and no entry in the period
  history. Reaching past recaps is a later idea (the roadmap records it), because it has to survive changes of period
  kind.

**Notification.** Always, for every kind: a local notification (`expo-notifications`, the same permission flow as the
budget alerts of §5.8) at **09:00** on the first day of the next period, «Il tuo mese si è chiuso: guarda il
riepilogo». The sentence is one i18n key per kind, because the noun changes gender («La tua settimana si è chiusa»).
It carries **no amount**, so hidden mode has nothing to hide. One pending notification (`period-recap:{start}`),
rescheduled whenever the period definition changes; none when the permission is denied. Tapping it opens the app,
which shows the sheet by the rule above. Making it optional is a later setting.

**Content** (`periodRecap` in `@saldo/core`, pure, with injected `today`; computed, never stored, so a transaction
entered late for the closed period changes the recap as it changes the stats):

| Block | Rule |
| --- | --- |
| Net | `income − spent` of `summarizePeriod` over the closed period (counted transactions only, §5.3). |
| Comparisons | the net of the period before, and **«di solito»** = the median net over the history window of §5.5 (6 used periods before the closed one). No history → the comparison is left out. |
| Income, expenses | each with `deltaPercent` against the period before; left out when the period before has none. |
| Categories | the **top 5** by spend, at parent level (`rollupToParents`), then «Altre N categorie · {total}». The one with the largest **positive** delta against its own median (§5.5) is tagged «+X% sulla media»; a category with no history is never tagged. |
| Budgets | budgets that existed by the closed period's last day (`createdAt`): those of kind `period`, plus week/month/year budgets **whose own calendar range ends on the closed period's last day** (a monthly budget in a month recap; never a yearly budget in a September recap). Each is measured as a closed period (§5.8): spent against its effective limit, «Nei limiti» or «Sforato di {x}», and with rollover «riporti {carry}» (`budgetCarry` into the new period). No budget → the section is left out. |
| Biggest expense | the single counted expense with the highest amount: description (or category name), category, date. |
| Net worth | `netWorth` at the end of the closed period minus `netWorth` at the end of the period before it. |

**Screen and motion.** The sheet is described in §6.39. It is seen at most once a period, so its entrance may take its
time: the staged chunks of the onboarding (`motion.stepEnterMs`, `stepChunkStaggerMs`, `stepEnterOffset`, title words
at `stepWordStaggerMs`), the net rolling from zero over `motion.countMs`, the bars growing (`motion.progressMs`,
`staggerMs`) when their section scrolls into view. Leaving is quicker than arriving. With reduced motion only the fades
remain. The mockup is `.variants/period-recap.html` (not committed).

### 5.16 In-app explanations

Three surfaces, one text (D28). The explanations are **content, not code**: every concept has
`guide.<concept>.title`, `.summary` (one sentence) and `.body` (short paragraphs separated by a blank line) in every
catalogue, and the parity test holds them together. One typed list, `GUIDE_CONCEPTS` in
`apps/mobile/src/features/guide/concepts.ts`, gives each concept its id, icon, section and whether it is in the intro;
the intro, the ⓘ and the Guida all read it.

| Section | Concept | Icon | Intro | ⓘ next to |
| --- | --- | --- | --- | --- |
| Le basi | `period` — the period restarts Home, budgets and stats | cal | ✓ | Period sheet «Tipo di periodo»; Profile «Inizio del ciclo» screen |
| Le basi | `remaining` — «Rimasto da spendere» is income − spent, not a balance (§5.3) | wallet | ✓ | — (Home stays clean) |
| Le basi | `transfers` — a transfer is neither an expense nor income, a card payment included | swap | ✓ | — |
| Conti | `accountTypes` — the type decides Totale spendibile; a debit card is its own account | landmark | | «Tipo» in the account sheet and onboarding step 2 |
| Conti | `creditCard` — spend on the card, pay it with a transfer, «Salda carta» | card | | «Addebitata su» in the account sheet |
| Pianificare | `budgets` — a ceiling per period, the pace tick, rollover | target | | the new/edit budget sheet's title |
| Pianificare | `goals` — a pocket inside a real account, out of Totale spendibile | piggy | | goal wizard step «Dove li tieni» |
| Pianificare | `recurring` — «Ripeti», occurrences ahead, the scope sheet | repeat | ✓ | «Ripeti» in the transaction sheet |
| Pianificare | `forecast` — three periods ahead from recurrences and the usual discretionary spend (§5.17) | trend | | the «Previsione» sheet's title |
| Organizzare | `tags` — one category, any number of tags | tag | | — |
| Organizzare | `hidden` — hidden mode hides sums, not single rows | eyeOff | | — |
| I tuoi dati | `data` — on the phone, on a server if connected, back it up | server | | — |

Ranked by what a misunderstanding costs: the period, «Rimasto da spendere» read as a bank balance and a transfer (or a
card payment) recorded as an expense change every number from the first day, so they are the intro, with recurring
transactions because rent and salary are what a new user enters first. The rest are met later and get an ⓘ where the
question comes up, or only a Guida page where the screen already says it in a sentence (Totale spendibile, «Escludi
dai totali», tags).

**First-run intro.** Once, after onboarding (§6.40). «Already seen» is device-local and not synced:
`kv.introSeenFor = settings.onboardingCompletedAt`, written on «Continua». It is due whenever
`onboardingCompletedAt` is set and differs from the stored value, so finishing onboarding again («Rivedi la
configurazione iniziale», «Elimina tutti i dati», a device reset) shows it again, and a second phone signing in to an
account shows it once. It waits for the period recap (§5.15): one sheet at a time, the recap first.

**Labels fixed instead of explained.** «Ciclo» meant any period in copy written before §5.2 had four kinds; where it
means the period in general it now says «periodo» (Statistiche, Home «Avanzato nel periodo», the budget median hint,
«Escludi dai totali», «Ripeti»), and the pay-cycle strings keep «ciclo». «Includi nel saldo disponibile» becomes
«Includi nel totale spendibile», the name of the figure it changes. The same in every language.

**Not now.** A «Novità» sheet after an update reuses the intro with another list of ids once there are releases (0.9).

### 5.17 Forecast

Derived, never stored: `forecastPeriods(input)` in `@saldo/core`, pure, `today` injected. Offered only when the selected
period is a whole period (not a custom range) containing `today`, and the §5.5 window of the current period holds **at
least 3** used periods; otherwise `null` and nothing of it renders — a forecast from one month of data would fake
confidence. Money stays integer minor units; each median is rounded once.

- **Horizon:** the 3 periods after the current one, `shiftPeriod(def, current, 1..3)`, in the user's own period kind
  (§5.2). Fixed; no selector.
- **Window:** `periodHistory(txs, def, current)` (§5.5). Per window period: `discretionary = max(0, spent − committed)`
  as in «Quota impegnata», and `oneOffIncome` = counted income with `recurrenceId = null`.
- **Scheduled** amounts of a forecast period = every counted-if-it-had-happened row already dated in it (not a transfer,
  not `excludeFromTotals`: materialised occurrences as edited, and anything the user dated ahead) **plus** the
  occurrences of live recurrences (`deletedAt = null`, template not a transfer and not excluded) dated in it **after
  `recurrenceHorizonEnd(def, today)`**, which the materialiser has not written yet (§5.9). A missing occurrence before
  that horizon was deleted by the user and stays deleted; a recurrence that ends inside the horizon contributes only
  its remaining dates.
- **Per forecast period:** `expenses = scheduledExpense + median(discretionary)`, `expensesMin/Max = scheduledExpense +
  min/max(discretionary)`, `income = scheduledIncome + median(oneOffIncome)`.
- **Balance:** starts from today's **Patrimonio complessivo** (`netWorth`, §5.3), adds the rest of the current period —
  scheduled income after today, minus `projectEndOfCycle − spent` (the §5.7 projection's remaining expenses) — then
  `balance_i = balance_{i−1} + income_i − expenses_i`. Excluded rows and transfers stay out, as in every statistic.
- **Sheet «Previsione»** (ⓘ `forecast`, §5.16): «Al {data di fine} circa» with the last balance at `amountMd`, then one
  row per forecast period — its range (`formatCycleRange`), the net, «~{saldo}», a track with the min–max expenses band
  and a tick at the estimate, «Uscite ~{expenses}» and «tra {min} e {max}» — and one footnote on how it is computed.
  In hidden mode every figure is masked and the bands and ticks are not drawn.
- **Not now** (ROADMAP 0.2): per-category forecast, seasonality, a «what if» slider, a Home card, the dashed balance
  continuation in account detail.

---

## 6. Screens (mobile) — inventory & behaviour

The layout reference is a 390×844 frame. Implement with safe-area insets instead of the fake status bar (design lines
47–50 and 1618–1621 are **not** implemented). All numbers use `fontVariant: ['tabular-nums']`.

Navigation (Expo Router):

```
app/
  _layout.tsx                 providers: DB, theme, i18n, auth, sync, gesture, bottom-sheet
  (onboarding)/               welcome, cycle-day, first-account, categories
  (tabs)/_layout.tsx          custom tab bar: Home, Transazioni, [+ FAB], Statistiche, Conti
  (tabs)/index.tsx            Home
  (tabs)/transactions.tsx
  (tabs)/stats.tsx
  (tabs)/accounts.tsx
  transaction/[id].tsx        detail (push)
  budgets.tsx                 list (push)
  account/[id].tsx            detail (push)
  category/[id].tsx           detail (push)
  tag/[id].tsx                tag view (push)
  settings/index.tsx          Impostazioni
  settings/categories.tsx
  settings/tags.tsx
  profile.tsx
  profile/server.tsx          NEW: server connection & sync status
  profile/import.tsx          NEW: CSV import wizard
  lock.tsx                    NEW: app lock screen
```

Sheets use `@gorhom/bottom-sheet` (or the current Expo-recommended equivalent) with a scrim of `rgba(0,0,0,0.55)`,
top radius 14, handle 36×4, and slide-up animation 280ms (300ms for tall form sheets) with easing `(0.32,0.72,0,1)`.

| # | Screen | Design lines | POC notes |
| --- | --- | --- | --- |
| 6.1 | **Home** | 54–178 | Header: avatar initials (from display name, or "S" when there is none) → Profile — the only entry point the design gives the profile, and it belongs to the home header alone, not to the shared period header the other tabs use; period button (label + "giorno X di Y" / "ciclo chiuso") → Period sheet; ‹ › cycle nav. Cards, in this order: Remaining; **In arrivo** (only if upcoming exist, at most 5 shown, the header counting them all; it holds only the rows dated after today inside the selected period, so it never shows the next period, §6.15) — it sits second because it is what corrects the figure above it; Budget and **Obiettivi**, both target cards (§5.13), **always shown**: with none they read "Nessun budget" /
"Nessun obiettivo" and their row opens §6.4 / the goal wizard (§6.37); Ultime transazioni (5). Each list card's **header is its action** (title, status, chevron, whole row tappable) rather than an accent line of text at the bottom — except the target cards, whose one action is their last row, «Tutti …» (§5.13), a full row with rings rather than a line of text. **Andamento del ciclo moved to Statistics** (§6.3), next to the six cycles it is a close-up of: it is the one card here that is read rather than glanced at. |
| 6.2 | **Transazioni** | 180–251 | §5.12. Title + period button, sticky search + chips. **The list shows what has happened**: everything dated after today is folded behind one "In arrivo" row carrying the count and the net, which expands the upcoming days in place rather than opening a screen — same rows, same swipes, and you are looking to glance, not to navigate. The upcoming rows stop at the end of the selected period. A row dated in the next period does not show here (§6.15); the user finds it in the recurrence detail (§6.33) or in the forecast (§5.17). Expanded, the two runs are separated by labelled rules ("Dopo oggi" / "Già registrate"), since the toggle row has scrolled away by the time the future ends. An **account filter** chip opens a single-select sheet (all accounts, archived included, one check) and is also seeded by the `accountId` route param, which is how "Ultime transazioni" on an account detail opens this list. A **Ricorrenti** row under "In arrivo" (only when a recurrence exists) opens §6.33. |
| 6.3 | **Statistiche** | 253–350 | §5.7. |
| 6.4 | **Budget list** | 352–392 | Cards with icon, name, "N giorni rimasti" / "Periodo chiuso", spent/limit, bottom bar + pace tick; "+" and dashed "Nuovo budget". Tap → Budget detail sheet. |
| 6.5 | **Conti** | 394–469 | **Patrimonio complessivo first**, as the hero — it is the question the screen answers and it needs no explanation — with Totale spendibile under it on its own line plus a sentence saying what it leaves out (savings and investments); spendable list, "Risparmi e investimenti" list — an account holding pockets shows its **bank balance**, with its pockets
indented under it (ring, name, balance) and a last «liberi» line for its own balance (§5.14) — Patrimonio complessivo, a **"Conti archiviati" row** with the count, opening `settings/archived-accounts` (the collapsible list of the prototype became that screen, so the Accounts tab and the Profile row lead to the same place). An archived account offers **Ripristina and nothing else**: its detail hides edit, transfer and archive, and `account/edit` refuses with the same restore button, since a deep link can still reach it. Header: settings gear, "+". |
| 6.6 | **Transaction detail** | 471–536 | Amount (44px), title, rows Categoria (dot), Conto (transfer: "A → B"), Data (long format with year), Nota (note, or the cadence — "Ricorrente, ogni mese, il 18" — / "Registrata manualmente"), a **Ricorrenza** row (the end) that opens §6.34, Esclusa dai totali. Tag chips → Tag view. **Attachments:** "Scontrino"/"Allegati" horizontal list of 96×124 thumbnails, tap → full-screen viewer (pinch-zoom; PDFs open in the system viewer). "Modifica" → edit sheet. |
| 6.7 | **Impostazioni** | 538–584 | **Not built as a separate screen.** Every row of it is already in 6.8 Profilo — categories, tags, the period, the currency — and in the prototype the two screens differ only in how you reach them. The gear on Accounts opens the Profile, and "Rivedi la configurazione iniziale" moved there. One list, one place to change a setting. |
| 6.8 | **Profilo** | 586–669 | Inizio del ciclo, Valuta (row shows the **symbol** next to the code), Lingua, Tema, **Fuso orario** (D37; see below) — each one a **pushed screen** under `profile/`, not a bottom sheet: same place Categorie and Tag already went, and the only place the cycle footnote and the currency confirmation have room; **Budget** (→ §6.4, the second way in now that the home card is not the only one), **Obiettivi** (→ §6.35), Categorie, Tag, **Conti archiviati** (its own screen, `settings/archived-accounts`, with Ripristina per row — pushing the Accounts tab landed at the top with the archived accordion shut, which is not what the row promised; the accordion on the tab stays); **Server e sincronizzazione** (NEW row → `profile/server`); Importa transazioni (CSV) → import wizard; Esporta i dati (sheet: JSON backup, CSV transactions); **Ripristina backup** (NEW, JSON); Blocco con Face ID/biometria toggle; **Elimina tutti i dati** (NEW → `profile/delete-data`, §8.6); Esci (only when signed in: revoke refresh token, keep local data, stop sync); version from `expo-application`. **Fuso orario** (`profile/timezone`, mockup `docs/superpowers/mockups/2026-09-26-timezone-variants.html`, variant «Viaggio + ora»): the row shows the saved zone's city. The screen has the line «Resta questo anche quando viaggi: il periodo si chiude a casa tua», a search field, then the saved zone (and the phone's, if different) on top and every zone A–Z, each row with city, generic zone name and the **local time now**, not the GMT offset. Selecting saves at once, with a check, as Lingua does. When the phone's zone differs from the saved one, the Profile row says «Il telefono è su {città}» under the title, and the screen opens with a notice («Il telefono è su New York, dove sono le 10:45. I conti restano su Roma finché non lo cambi.») and a «Usa {città}» button. City names: a short translated list for common cities, IANA's English name otherwise. |
| 6.9 | **Categorie** | 671–727 | §5.11. |
| 6.10 | **Account detail** | 729–804 | Edit, archive (confirm toast), icon/name/kind, balance, delta over last 8 months, sparkline of month-end balances over 8 months (labels first/last month), credit card box (one list: Maturato; "Prossimo addebito" with the charge date as its subtitle — "5 ottobre · Estratto conto" and the amount due on the right while a statement is due, "✓ Saldato" once it is paid; the prototype's note naming the close and charge days and the payment account; a **Salda carta** row, which opens the new-transaction sheet as a transfer from the payment account to the card, for the statement due, dated on its charge day — or today if that has passed — with the description "Saldo {card} · {month}", every field editable and nothing written until saved), cycle income/expense tiles, "Trasferisci verso un altro conto" → new transfer sheet, last 6 transactions. |
| 6.11 | **Tag view** | 807–857 | §5.10. |
| 6.12 | **Category detail** | 859–934 | §5.7. |
| 6.13 | **Tag admin** | 936–957 | List with count; tap → Modifica tag sheet. Footnote copy from design. Reached from Profilo as **"Gestisci i tag"**: reading what a tag cost belongs to Statistiche (§5.7), this screen is for renaming, merging and deleting. |
| 6.14 | **Tab bar + FAB** | 961–975 | Height 78 + bottom inset; FAB 56×56, radius 18, accent, raised −16px. FAB opens new transaction sheet. |
| 6.15 | **Period sheet** | 981–1009 | Lists the last five periods ending with the selected one (current first, with a check on the selected one; sub "in corso, giorno X di Y" or "{expenses} di uscite"); then **Periodo personalizzato** (date range picker, `start <= end`), **Tipo di periodo** (mese / settimana / ciclo di stipendio / anno → writes `settings.periodKind`) and, under the cycle kind only, **Giorno di inizio ciclo**. Remove the prototype's "non disponibile offline" rows (everything is local). | **Forward navigation stops at the current period** (`canShiftPeriod`, `MAX_PERIODS_AHEAD = 0`, decided 2026-09-26; it used to stop one period after). The next period holds materialised recurrences (§5.9) and anything dated ahead, but its screens were otherwise empty cards and Statistics already shows it as the forecast (§5.17); those rows are not shown in «In arrivo» (Home §6.1 and Transazioni §6.2), which stops at the end of the selected period (changed 2026-10-11). The user finds them in the recurrence detail (§6.33) and in the forecast (§5.17). The › arrow greys out rather than opening nothing. The custom range's calendar is bound the same way: no day after the end of the current period can be picked (`maxDate`), so no future window is ever selected.
| 6.16 | **New/Edit transaction sheet** | 1011–1174 | Kind segmented (Uscita/Entrata/Trasferimento); amount display (tap reopens keypad in edit mode); category grid 4 cols (**top 7** by usage + "Altro" → full picker incl. subcategories; seven plus the tile is two rows, which is what keeps the account, the date and the tags above the fold — ten was three rows and hid them); account chips (non-archived) **and** the date row **above** the category grid, since both are set on nearly every transaction and the grid used to bury them; transfer Da/A pickers; date chips Oggi/Ieri + Saldo's own calendar sheet (not the platform picker); Descrizione (placeholder "Dove"/"Da chi"); Tag input with suggestions, create, selected chips; **Allega foto** (action sheet: Scatta foto / Scegli dalla libreria / Scegli file PDF; shows count badge + thumbnails); **Ripeti** chip row under Data (Mai / Ogni mese / Ogni settimana / Altro › sheet) with a one-line summary and "Cambia"; on an occurrence a read-only "Gestisci ›" row instead; Escludi dai totali toggle + footnote; Elimina (edit only). The amount is the big figure, focused automatically on a new transaction and typed on Saldo's keypad (D23), which opens with the sheet; there is no separate save column. Save is disabled until amount > 0, an account is chosen, a non-transfer has a category and a transfer has a different destination. Opened from **Salda carta** (§6.10) the sheet is pre-filled and, when the two amounts differ, shows a two-way segmented choice under the figure ("Estratto conto" / "Tutto il saldo", label over amount); typing anything else fades the thumb and reads "Importo personalizzato". A transfer that would take a credit card above 0 shows, inline in the amount card, a muted "La carta andrà in attivo di {amount}." (`transferOverpaysCard`) and stays saveable. On a transfer, a chip under the figure — «Tutto il saldo · {amount}» — fills the amount with what the **Da** account holds today (§5.3; the row being edited left out, so re-editing offers the same total); it follows the Da picker and is absent when that balance is 0 or less, so a credit card offers it only while in credit. When **A** is an open goal that still lacks money, a second chip «Quanto manca · {amount}» fills target − saved, capped at the source's balance, and shows only when it is smaller than the first. Towards a credit card there are none: paying a card, what counts is its debt, which «Salda carta» offers under the same label. The chips come from `transferFillAmounts` and write nothing (decided 2026-09-25). |
| 6.17 | **Budget detail sheet** | 1176–1209 | §5.8. Add "Modifica" (opens budget form prefilled) and "Elimina budget". |
| 6.18 | **New budget sheet** | 1211–1283 | **New is a three-step wizard** (categorie → importo → dettagli), edit stays one page: six decisions on one screen meant the ones below the fold were missed, and the median suggestion is computed from the categories, so it cannot be offered before them. Amount input + currency symbol, median hint + "Usa", category grid 2 cols with taken dots, Nome (auto placeholder), Aspetto row (icon only, same grouped picker as categories; the icon follows the first category until picked, the colour always does), Si ripete segmented, Avvisami a segmented + note, Porta avanti il residuo toggle, footnote ("+12% sulla mediana di spesa"), "Crea budget" disabled until valid. Reused for edit ("Salva"). |
| 6.19 | **Category sheet** | 1285–1362 | Preview tile, name, icon search + grouped grid (7 cols; groups Casa, Trasporti, Cibo, Salute, Svago, Lavoro, Animali e natura, Acquisti, Tecnologia, Denaro with search labels from design `ICON_LABEL`, translated), 24 colour swatches with ring, Categoria madre picker (only top-level, same direction; hidden if the category has children), Budget mensile toggle + amount, Archivia (edit only), Salva disabled until name. |
| 6.20 | **Archive category sheet** | 1364–1384 | §5.11. |
| 6.21 | **Recurrence scope sheet** | 1386–1403 | §5.9. |
| 6.22 | **Account sheet** | 1405–1481 | Balance display with keypad, name, type grid 3 cols, credit close/charge day pickers and **Addebitata su** (`creditPaymentAccountId`: a sheet of non-card, non-archived accounts, or "Nessuno"), colour swatches + 13 icons, "Includi nel saldo disponibile" toggle + note, Salva. The balance may be negative (sign tile in front of the digits, §5.1). In edit mode, the amount edits **current balance**: store `openingBalance = entered − Σ(transaction effects)`. |
| 6.23 | **Tag filter sheet** | 1483–1502 | Multi-select by usage, Azzera / Fatto. |
| 6.24 | **Tag edit sheet** | 1504–1543 | §5.10. |
| 6.25 | **Currency sheets** | 1545–1579 | §5.1. The design lists four currencies; with 162 supported the sheet needs a **search field** and a "Comuni" section (`COMMON_CURRENCY_CODES`) above the alphabetical list. Rows show code, symbol and localised name. |
| 6.26 | **Delete dialog** | 1581–1592 | Centered card, scrim 0.6. |
| 6.27 | **Toast** | 1594–1601 | Bottom 92px above tab bar, 4s (5s with undo). |
| 6.28 | **Attachment viewer** | 1603–1614 | Black full-screen, close button, pinch zoom, swipe between attachments, share, delete attachment. |
| 6.29 | **Onboarding** | 1616–1717 | Step 0 **Welcome** (not in design; same visual language: Rocky waving above a 32px title, muted body; §13 *Mascot*): two doors of equal weight in one card: **Solo su questo telefono** (straight to the chooser; nothing is saved until onboarding finishes, and the chooser offers «Indietro» back here) and **Con il tuo server Saldo**, a step of its own ("Il tuo server Saldo"): the address field, whose hint previews the origin; «Continua» calls `GET /api/health`; the card swaps in place into a server row — server icon, host, a filled green dot with «Saldo {version}», «Cambia» — and «Accedi con passkey» (plus «Crea account» when the server allows it) appears below. A failure is the same row with a hollow grey ring and words (no red: `positive` stays the palette's only chromatic signal): «Non raggiungibile» → «Riprova» (a second failure adds «Ancora nessuna risposta.»), «Non è un server Saldo» → «Cambia indirizzo». On success it pulls; if the server already has settings with `onboardingCompletedAt`, the rest is skipped. After a sign-in the chooser has no «Indietro»: going back would mean leaving the account. Then a **chooser**, "Come vuoi iniziare?": *Da zero* (the four steps below), *Importa un export* (the import path), or *Ripristina un backup* (the §11.1 restore screen; the backup brings its own settings, so the boot router goes to the tabs). *Da zero* is **five steps**: 1 **period** (four kinds, the "il tuo periodo va dal X al Y" timeline as the card's last line; the pay cycle then asks its start day on a screen of its own, 7-col grid 1–28, under the same step number), 2 account details (name, and the type as a three-column grid of tiles offering all six types, icon over label), 3 current balance (may be negative, §5.1) + currency, 4 categories, 5 **permissions** (below). Steps 2 and 3 are split so each screen asks one thing and the balance gets the whole screen with the keypad up. On the two steps that hold an amount (3 here, 4 on the import path) the keypad is **pinned**: it never closes, its tall key is «Continua», and the footer hides its own primary button so the step is not offered twice — «Indietro» stays, because the way back must never disappear. Progress bar 2px. Step 5, **permissions**, is the same on both paths: notifications (budget alerts, §5.8), camera (attachments, §10) and the biometric app lock (§6.32), one row open at a time with a sentence, «Attiva» and «Più tardi». The system prompt is called only from «Attiva», so the one prompt iOS allows is never spent before the user has read why; a permission the OS already decided shows its state instead of asking, and a denied one links to the system settings. «Più tardi» leaves the in-context request as it was (§5.8, §10). «Inizia» is on this step. Profile → **Permessi** shows and changes notifications and camera afterwards. "Inizia" (step 5) writes settings + account + categories, and the lock flag when step 5 turned it on. The **import path** is five steps too: 1 period, 2 currency (the file's; the four common chips and "Altra…" for the full §6.25 list), 3 the §11.3 wizard with nothing existing yet, its accepted plan kept in the draft, 4 **one current balance per imported account** (sign tile in front of the digits, §5.1), each starting at what its imported history adds up to, 5 **permissions**. It has no category grid: categories come from the file, plus the hidden seed rows. "Inizia" writes settings, the hidden categories and the import in one transaction, each account with `openingBalance = entered − Σ imported effects` (`importedBalances`, the §6.22 rule). As on the fresh path, nothing is written before "Inizia", and nothing at all if a sync delivered settings meanwhile. |
| 6.30 | **Server & sync** (NEW) | — | The server address (typed by the user, stored on the phone), status (Non connesso / Connesso come {name} / Ultima sincronizzazione {relative time} / Errore), "Sincronizza ora", "Esci", pending changes count, attachment upload queue count. Not connected, the screen is the §6.29 server step, prefilled with the last address that worked. «Esci» keeps the data and leaves the app local-only. |
| 6.31 | **Import wizard** (NEW) | — | §11.3 steps, each a full screen with a sticky bottom CTA. |
| 6.32 | **Lock screen** (NEW) | — | Rocky asleep (§13 *Mascot*) + "Sblocca" button; auto-prompts biometrics (`expo-local-authentication`) on cold start and after 60s in background when enabled. Falls back to device passcode. |
| 6.33 | **Ricorrenti** (NEW) | — | Reached from the Transactions tab. "Ogni mese, in media": Σ amount × occurrences-per-month over live recurrences, expenses and income apart, transfers left out; bar = expense/income when there is income. Then one card per cadence ("Ogni mese", "Ogni 2 settimane", …) with rows name · cadence · prossima date · signed amount → §6.34; ended series in a last card. Empty state points at "Ripeti". |
| 6.34 | **Recurrence detail** (NEW) | — | Name, amount, cadence and next date; rows Cadenza › and Fine › (both open the Ripeti sheet on a draft, applied on close per §5.9), Prima occorrenza; every occurrence, newest first, upcoming ones with the 2px rule; "Modifica" opens the edit sheet of the next upcoming occurrence (or the latest), which asks the scope; "Smetti di ripetere" confirms with the real count of scheduled rows. |
| 6.35 | **Obiettivi** (NEW) | — | `goals.tsx`, push. One card per open goal, in sort order: icon, name, "entro {deadline}" / "senza scadenza", saved over target, 4pt bar with pace tick, the sentence of §5.14. "+" and dashed "Nuovo obiettivo" → §6.37. A last row «Obiettivi chiusi · {n}» lists the archived ones, each with Ripristina. A reached goal's card has Rocky peeking over its top edge (§13 *Mascot*). |
| 6.36 | **Goal detail** (NEW) | — | `goal/[id].tsx` for a pocket's id. The featured block of §5.13 at full width, then «Accantona» and «Preleva» (prefilled transfers, §5.14), rows Conto (the parent), Scadenza, Creato il, then the pocket's transactions, newest first. Header: «Modifica» (§6.37 on one page) and a «Chiudi obiettivo» row at the bottom (§6.38). An archived goal shows Ripristina only, as an archived account does (§6.5). A reached goal has Rocky peeking over its card (§13 *Mascot*). |
| 6.37 | **New goal sheet** (NEW) | — | A **wizard** like the new budget (§6.18): 1 name and look (icon and colour, the account picker's grid); 2 target (keypad, D23); 3 deadline, optional (Saldo's calendar, «Senza scadenza»); 4 «Da quale conto» (cash, checking, debit card, savings; non-archived) and «Già da parte» (keypad, 0 allowed; the parent's own balance shows as a hint, and more is accepted, since a parent may go negative). «Crea obiettivo» writes the pocket and, when «Già da parte» > 0, the transfer from the parent, in one database transaction. Edit is one page without step 4. |
| 6.38 | **Close goal sheet** (NEW) | — | «Hai usato i soldi?» with the balance; «Registra la spesa» and «Riporta in {parent}» (§5.14); with a zero balance it only confirms. Archives the pocket and returns to the list with the toast «Obiettivo chiuso». A reached goal's sheet opens with Rocky celebrating above the question (§13 *Mascot*); an unreached one has none. |
| 6.39 | **Period recap sheet** (NEW) | — | §5.15. Full-screen sheet over the Home of the new period, shown once. Eyebrow with the closed range («1 – 30 settembre 2026»), title «{Settembre} si è chiuso». A card: «Netto del mese» (34pt, positive colour when ≥ 0, signed), the comparisons line («Agosto +195,10 € · di solito +356,80 €»), Entrate and Uscite with their deltas. Then, all open and in this order: **Categorie** (dot, name, amount, bar relative to the top one; the tagged category's bar in accent), **Budget** (name, spent «di» limit, bar, the status line; «Sforato» in accent **and** in words), **Altro** (Spesa più grande — a single transaction, so its amount stays readable in hidden mode like a list row; Patrimonio as its change over the period). Footer: «Inizia il nuovo {mese \| settimana \| ciclo \| anno}», which dismisses it; there is no other way back into it. Every other amount follows hidden mode (the aggregate rule). No Rocky (D26). |
| 6.40 | **First-run intro** (NEW) | — | §5.16. Full-screen modal over the tabs, shown once. Title «Come ragiona Saldo» (32pt), then the four intro concepts as rows: a 44pt icon box, the title (semibold) and the summary (muted). Footnote «Le ritrovi, con le altre, in Profilo → Guida.», then «Continua», the only button, which marks it seen. The rows arrive staggered (`stepEnterMs`, `staggerMs`); with Reduce Motion only fades. Each row is one accessibility element (title, summary). No Rocky (D26). |
| 6.41 | **ⓘ sheet** (NEW) | — | §5.16. `InfoButton`: the `info` icon at 16pt, muted, right after a label, 44pt hit area, labelled «Informazioni: {title}». It opens a sheet: icon box, title, the summary in the text colour, the body paragraphs muted, «Fatto». The same content as the concept's Guida page. |
| 6.42 | **Guida** (NEW) | — | `guide/index.tsx`, from a Profile row «Guida» next to «Rivedi la configurazione iniziale». Title «Guida», subtitle «Come ragiona Saldo, un'idea alla volta.», then one card per section (Le basi, Conti, Pianificare, Organizzare, I tuoi dati) with a row per concept: icon, title, summary, chevron → `guide/[id].tsx`: icon box, title (display), a card with the summary and the body. |

Visual rules for NEW screens: use only tokens from `@saldo/ui` and the component primitives built for the design
screens (Card, ListRow, SectionLabel, Toggle, Segmented, PrimaryButton, SecondaryButton, TextField). No new colours.

---

## 7. Local data layer (mobile)

- `expo-sqlite` with `enableChangeListener: true`, Drizzle ORM `drizzle-orm/expo-sqlite`, migrations generated by
  `drizzle-kit` (`dialect: 'sqlite', driver: 'expo'`) and applied at startup with `useMigrations`. Show a blocking
  error screen if migration fails.
- Tables mirror §4 entities in snake_case columns. Arrays (`tag_ids`, `category_ids`) and the recurrence template are JSON text
  columns. The Drizzle `mode: 'json'` columns are typed from the core Zod types.
- Every synced table has extra columns: `updated_at TEXT NOT NULL` (HLC), `deleted_at TEXT NULL`,
  `sync_state INTEGER NOT NULL DEFAULT 1` (0 = synced, 1 = pending).
- Indexes: `transactions(date)`, `transactions(account_id, date)`, `transactions(category_id, date)`,
  `transactions(recurrence_id)`, and `sync_state` on every synced table (partial index `WHERE sync_state = 1`).
- **Repositories** (`src/db/repositories/*.ts`) are the only writers. Every mutation:
  1. validates with the core Zod schema,
  2. stamps `updatedAt = clock.now()` (and `createdAt` on insert),
  3. sets `sync_state = 1`,
  4. runs in a transaction when it touches multiple rows (merge tags, archive-and-move, recurrence scope edits),
  5. notifies `SyncScheduler.onLocalWrite()`.
- Reads return core types. Screens compose `useLiveQuery` hooks for raw rows and run `@saldo/core` calculations
  inside `useMemo`. POC data volume (≤ 20k transactions) keeps this fast. Load only the date ranges needed
  (the selected cycle + 6 previous for baselines).
- Device-local key/value store: `expo-secure-store` for tokens; a `kv` SQLite table (not synced) for `deviceId`,
  `serverUrl` (the signed-in server; absent means local-only), `lastServerUrl` (prefill after «Esci»), `accountId`,
  `syncCursor`, `syncEpoch`, `dataResetNotice`, `appLockEnabled`, `lastAlertPeriodStart:{budgetId}`.
- **Dev seed:** in `__DEV__` builds, Profile shows "Carica dati demo". It generates data equivalent to the design mock
  (`CYCLES`, `TAG_EXTRA`, `ACCOUNTS`, `BUDGETS`) shifted so the current cycle contains today.
- Optional hardening (documented, not required): enable SQLCipher via the `expo-sqlite` config plugin
  `useSQLCipher: true` with a key from secure store.

---

## 8. Sync

### 8.1 Model

- Unit of sync = one entity row (whole-row last-writer-wins).
- Entity names: `settings, account, category, tag, transaction, recurrence, budget, attachment`. Goals are accounts
  (D24) and add no entity.
- Order of application doesn't matter for integrity (no FK constraints across synced tables locally; the UI tolerates
  dangling references by showing "—" and repositories filter tombstoned parents).
- **Unknown enum values on pull — decided: a schema-version gate, with per-row error state as the backstop.**
  `SYNC_SCHEMA_VERSION` (an integer in `@saldo/core/sync/protocol.ts`) is bumped whenever a synced schema changes in a
  way an older peer cannot represent — a widened enum, a new required field. It travels in the push body, in the pull
  response and in `/api/health`; a mismatch stops the cycle with a message that names the fix ("update the app" /
  "update the server", `409 schema_too_old` / `schema_too_new`) instead of letting rows diverge silently. A row that
  still fails validation is marked `sync_state = 2`, counted on the Server screen, and the cursor moves past it — one
  bad row must not wedge sync forever. Enums are still widened only when a real second value ships, which is why
  `alertThreshold` is a plain percentage rather than three literals.

### 8.2 Hybrid logical clock (in `@saldo/core/sync/hlc.ts`)

- String format: `{wallMs padded to 15 digits}-{counter base36 padded to 4}-{deviceId}`, for example
  `001775000000000-0000-7f3a…`. Lexicographic order = causal order; `deviceId` breaks ties.
- `now()`: `wall = max(Date.now(), last.wall)`; `counter = wall === last.wall ? last.counter + 1 : 0`.
- `receive(remote)`: `wall = max(Date.now(), last.wall, remote.wall)`; the counter is bumped accordingly (standard HLC).
- Clock state persists in `kv` so it survives restarts.
- Reject remote HLCs more than 24h ahead of the server's wall clock (server-side) to limit damage from broken device clocks.

### 8.3 API contract (all JSON, `Authorization: Bearer <access_token>`, `apiVersion: 1`)

`POST /api/sync/push`

```json
// request
{ "deviceId": "string", "changes": [
  { "entity": "transaction", "id": "0191…", "updatedAt": "HLC", "deletedAt": null, "data": { /* full entity per core schema */ } }
] }
// response 200
{ "results": [ { "id": "0191…", "entity": "transaction", "status": "applied" | "stale" | "invalid", "error": "string?" } ],
  "serverTime": "ISO" }
```

- Max 500 changes per request (client batches).
- Server per change: validate `data` with `entitySchemas[entity]` (the `id`, `updatedAt`, `deletedAt` inside data must equal
  the envelope). If stored row missing or `incoming.updatedAt > stored.updatedAt` → upsert and assign
  `seq = nextval('sync_seq')` → `applied`. Else → `stale` (client keeps its row and will receive the newer one on pull).
  Validation failure → `invalid` (client marks row `sync_state = 2` = error, surfaced in Server screen).
- Client marks `applied` and `stale` rows `sync_state = 0` **only if** the local `updatedAt` still equals the pushed
  one (a write during the request must stay pending).

`GET /api/sync/pull?since=<seq>&limit=500`

```json
{ "changes": [ { "entity": "…", "id": "…", "updatedAt": "HLC", "deletedAt": "ISO|null", "data": { }, "seq": 1234 } ],
  "nextSince": 1234, "hasMore": false }
```

- Client applies each change: if local row missing or `remote.updatedAt > local.updatedAt` → overwrite with
  `sync_state = 0`. Otherwise ignore. Advance the clock with `receive(remote.updatedAt)`. Persist `syncCursor = nextSince`
  after each page in the same SQLite transaction as the rows.

`GET /api/health` → `{ "app": "saldo", "version": "x.y.z", "apiVersion": 1, "registration": "open|first-user|closed" }` (no auth).

### 8.4 Server storage

```sql
create sequence sync_seq;
create table sync_rows (
  user_id     uuid not null references users(id) on delete cascade,
  entity      text not null,
  id          text not null,
  updated_at  text not null,
  deleted_at  timestamptz null,
  data        jsonb not null,
  seq         bigint not null,
  primary key (user_id, entity, id)
);
create index sync_rows_user_seq on sync_rows (user_id, seq);
```

The upsert uses `INSERT … ON CONFLICT (user_id, entity, id) DO UPDATE … WHERE sync_rows.updated_at < excluded.updated_at`
so concurrent pushes stay correct without application locks.

### 8.5 Scheduler (mobile)

- Triggers: app start (after auth), app foreground, 2s debounce after local writes, every 60s while in foreground,
  pull-to-refresh, and "Sincronizza ora". Never run concurrently (single-flight promise).
- Pull-to-refresh is offered on the tabs, the Server screen and the other screens that show synced data — never on a
  form, whose sheet already closes on a downward swipe, and never while signed out. The spinner follows the pull, not
  the scheduler's own cycles, and a pull that could not sync says so in a toast (could not sync, session expired, or
  the schema mismatch); one that worked says nothing.
- Cycle: push all pending (batches) → pull until `hasMore = false` → run recurrence materialiser → upload attachment
  blobs queue.
- Backoff on network/5xx: 5s, 15s, 60s, 5min cap. On 401: try refresh once, else go to "Sessione scaduta" state
  (local use continues).
- First sign-in on a device that already has local data (onboarded locally): push everything (full upload), then pull.
  There's no merge prompt in the POC; LWW applies.

### 8.6 Deleting all data

Profile → **Elimina tutti i dati** opens a screen that says what goes and enables its button only once the user types
`ELIMINA` (`DELETE` in English). It deletes every synced row and attachment of the account, on every device; the
passkey account stays, and so does the session.

- **Server.** `data_epochs (user_id pk → user on delete cascade, epoch int default 0, reset_at timestamptz)`.
  `DELETE /api/data` bumps the epoch, deletes the account's `sync_rows` and queues its attachment blobs in
  `deleted_blobs` as already past the grace period, in one transaction, and answers `{ epoch }`. `GET /api/data`
  answers the current `{ epoch }`.
- **Sync.** The push body carries `epoch` and the pull query `&epoch=`. A different value answers
  `409 data_reset`. The push compares under a `FOR SHARE` lock on the epoch row, inside the transaction that writes
  the rows, so it cannot interleave with a deletion.
- **The deleting phone** runs the request inside `scheduler.exclusive`. Only once the server has answered does it
  delete the attachment files and the synced tables, drop `syncCursor` and store the new `syncEpoch`. It keeps
  `deviceId`, `hlc`, `accountId` and `appLockEnabled`, then returns to the boot router, which opens onboarding. With
  an expired session it refuses and asks to sign in again. A phone with no server (local-only, or signed out)
  deletes the phone only.
- **Every other phone** learns on its next push or pull. On `data_reset` it asks `GET /api/data`, empties itself the
  same way (pending writes included) and runs the cycle again. The tabs then toast "Tutti i dati sono stati eliminati
  da un altro dispositivo" and return to the boot router if no settings are left.
- A phone that has never synced asks `GET /api/data` once, before its first push. "Esci" keeps `syncEpoch`, so a
  phone that signed out before the deletion is still refused when it signs back in.

---

## 9. Authentication (passkeys)

### 9.1 Server tables

**Authentication is Better Auth** (`better-auth` + `@better-auth/passkey` + `@better-auth/expo`), not hand-written.
Its schema is generated by `@better-auth/cli` into `apps/web/src/server/db/authSchema.ts` and re-exported from
`schema.ts`, so migrations stay a Drizzle concern:

```
user(id text pk, name text, email text unique, email_verified bool, image text null, created_at, updated_at)
session(id text pk, user_id text fk, token text unique, expires_at, ip_address text null, user_agent text null, …)
account(id text pk, user_id text fk, provider_id text, …)          -- unused: no social providers
verification(id text pk, identifier text, value text, expires_at)  -- challenges and one-time tokens live here
passkey(id text pk, user_id text fk, credential_id text, public_key text, counter int, device_type text,
        backed_up bool, transports text null, aaguid text null, name text null, created_at)
```

Notes that follow from using the library:

- `session` replaces the hand-rolled `refresh_tokens`: Better Auth renews a session as it is used, so there is no
  second credential to rotate and no reuse chain to revoke.
- `verification` replaces `webauthn_challenges` and `auth_codes`.
- `user.email` is required and unique, but a passkey-only account has no email, so it gets a synthetic address at
  `{id}@passkey.saldo.invalid` — RFC 2606 reserves `.invalid`, so the value can never route anywhere.
  **Superseded by D32 (§17.1.4):** from milestone 0.3 registration asks for a real email. Built in 0.3b: an account
  created before it keeps the synthetic address until the phone asks for a real one (onboarding, or Profile → server),
  which `POST /api/me/email` stores. That route only ever fills an empty seat — it answers `email_already_set` when the
  current address is not synthetic, because replacing a real one means proving the new one belongs to the person.
  SMTP now exists (0.3f-2, 0.3f-3), so that proof is buildable — a verified change of a real address is a follow-up
  in `TODO.md`; today a filled address stays as it is. `isSyntheticEmail` is the test, in
  `apps/web/src/server/auth/email.ts`; a synthetic address is never mailed.
- The passkey plugin does **not** create users: it needs an id that already resolves. The account is therefore
  written in `registration.afterVerification`, after the ceremony has succeeded, using the id the ceremony used as
  its WebAuthn handle. A ceremony the user abandons leaves nothing behind.
- `REGISTRATION` (§9.2) is enforced in `registration.resolveUser`, the last moment before an account would exist.

### 9.2 Environment

| Var | Example | Purpose |
| --- | --- | --- |
| `PUBLIC_URL` | `https://saldo.example.com` | Origin for WebAuthn + links. **HTTPS required** (except `http://localhost` for web dev). |
| `WEBAUTHN_RP_ID` | `saldo.example.com` | Relying party id. |
| `WEBAUTHN_RP_NAME` | `Saldo` | |
| `JWT_SECRET` | 32+ random bytes base64 | Better Auth's `secret`: signs session and handoff material. |
| `DATABASE_URL` | `postgres://…` | |
| `ATTACHMENT_STORAGE` | `none` | `none` \| `fs` \| `s3` \| `vercel-blob` (§10). |
| `STORAGE_DIR` | `/data/attachments` | Blob root. Required by, and only read by, `fs`. |
| `S3_BUCKET`, `S3_REGION` | | Required by `s3`. |
| `S3_ENDPOINT` | `https://…r2.cloudflarestorage.com` | Optional: what makes R2, MinIO, Backblaze and Hetzner work. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | | Required by `s3`. |
| `S3_FORCE_PATH_STYLE` | `true` | Needed by MinIO and some S3 clones. |
| `BLOB_READ_WRITE_TOKEN` | | Required by `vercel-blob`; Vercel injects it. |
| `SETTINGS_ENCRYPTION_KEY` | 32 random bytes base64 | **Required** (0.3f-2). AES-256-GCM key for the secrets in `server_settings` (§17.1.8). Anything that does not decode to exactly 32 bytes is refused, by name. |
| `REGISTRATION` | `invite` | **Optional** (0.3f-2). `open` \| `first-user` (only when no users exist) \| `closed` \| `invite` (§9.5). Set: wins and locks the panel. Unset: the `server_settings` row, else `first-user`. **0.3h:** the first account is allowed under every mode and needs no code; `/setup` creates it. |
| `INSTANCE_NAME` | `Casa Rossi` | Optional, 1–60 characters. Wins over the stored name; unset falls back to the row, then to `WEBAUTHN_RP_NAME`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | | Optional. `SMTP_HOST` set: the whole group comes from the environment and is locked (`SMTP_FROM` required, `SMTP_PORT` default 587, `SMTP_USER` and `SMTP_PASSWORD` together or neither). |
| `APP_REDIRECT_SCHEMES` | `saldo` | Comma list of allowed custom schemes for mobile redirects. |

### 9.3 Mobile sign-in flow (browser ceremony + one-time-token handoff)

A passkey ceremony needs `navigator.credentials`, which React Native does not have (§9.4), so it runs on a page the
server serves and the resulting session is handed to the app.

1. App: the user types the server address (§6.29 step 0, §6.30); `normaliseServerUrl` turns it into an origin (a
   bare host gets `https://`, a path is rejected, plain `http` is accepted only for `localhost`, `127.0.0.1`, `[::1]`
   and the Android emulator's `10.0.2.2` — over a network it would let anybody on the path answer as the server). «Continua» calls `GET /api/health`, which must return
   `app: "saldo"` and `apiVersion: 1` — no answer or a 5xx is «Non raggiungibile» (a proxy in front of a Saldo that
   is down answers 502/503), any other status or body «Non è un server Saldo» (`readHealth`);
   it also returns `schemaVersion` (§8.1) and `registrationAllowed`, which decides whether "Crea account" is offered.
   The address is stored (`kv.serverUrl`) only after a sign-in succeeds, and removed by «Esci».
2. App generates `state` (`expo-crypto`) and calls
   `WebBrowser.openAuthSessionAsync("{server}/auth/mobile?redirect_uri=saldo://auth/callback&state=…&mode=login|register", "saldo://auth/callback")`.
3. `/auth/mobile` (server component + client component) validates `redirect_uri` scheme ∈ `APP_REDIRECT_SCHEMES`
   **server-side, before any ceremony starts**. It shows "Accedi con passkey" and, when registration is allowed,
   "Crea account" with a name field.
   - Login: `authClient.signIn.passkey()` — discoverable, empty `allowCredentials`, so it cannot enumerate users.
   - Register: `authClient.passkey.addPasskey({ context: displayName, createSession: true })`; `context` is the
     plugin's passthrough to `resolveUser`, where the name and `REGISTRATION` are enforced.
4. The ceremony leaves the **browser** holding the session. The page mints a handoff token with the
   `one-time-token` plugin (`expiresIn: 1` minute, `storeToken: 'hashed'`, single use) and navigates to
   `saldo://auth/callback?ott=…&state=…`.
5. App checks `state`, then exchanges the token: `authClient.oneTimeToken.verify({ token })`. That call is what
   installs the session — `@better-auth/expo` stores it in `expo-secure-store`, under a prefix scoped by server URL.
6. Authenticated calls attach the stored `Cookie` header (React Native does not send cookies by itself);
   `auth.api.getSession({ headers })` reads either that or `Authorization: Bearer`. A 401 means the session is gone:
   the app shows "Sessione scaduta" and local use carries on.
7. Logout: `authClient.signOut()`.
8. **Whose rows are on the phone** is settled after step 5 and before the session is installed, because the first
   cycle would push every pending row into the account that just signed in. `kv.accountId` records the last account;
   rows of a **different** account are wiped after a confirmation (declining signs straight back out). Rows with
   **no** recorded account — a phone that started local-only — ask «Porta nell’account» (they stay pending and the
   first cycle pushes them, merging with what the account holds — except the one `settings` row, restamped with the
   oldest possible HLC so an account that has settings keeps its own; categories are not de-duplicated, so a phone
   seeded locally brings its own set), «Cancella e usa il server» (wipe, then pull) or
   «Annulla» (sign back out, phone untouched). An empty phone asks nothing.

**Accepted risk:** the handoff token travels in a `saldo://` URL, and on both platforms another app can register the
same scheme. It is single-use and lives one minute, so the window is narrow, but the real fix is a verified app link
(`webcredentials:` / `assetlinks.json`) — which needs a paid Apple Developer account, as §9.4 notes.

Rate limiting is Better Auth's (`rateLimit: { window: 60, max: 20 }`), and is per-process like any in-memory limiter.

### 9.4 Future: native passkeys

Documented only. Android: Credential Manager (`react-native-passkey`) + `/.well-known/assetlinks.json` served by
`apps/web` (the SHA-256 of the user's signing key is configurable via env). iOS: Associated Domains `webcredentials:` +
`/.well-known/apple-app-site-association`; requires a paid Apple Developer account.

### 9.5 Access control: invites and revocation

`REGISTRATION=invite` is the mode a shared instance runs in. Under it **no account is created
without a single-use code** — not even the first, which is what makes "the first account" and "the
person who installed the server" the same person rather than a race.

**The invite.** 16 symbols of Crockford's base32 (`I`, `L`, `O` and `U` are absent; a reader's
substitutions are folded on the way in), formatted `XXXX-XXXX-XXXX-XXXX` — 80 bits. The `invites`
table stores its **sha-256**, a label, who minted it, a TTL (7 days by default, 90 at most) and
what became of it. A code is shown exactly once, by the thing that mints it, and cannot be
recovered from the server afterwards.

The ceremony touches it twice. `resolveUser` **checks** the code before WebAuthn starts, so a bad
code costs nobody a fingerprint and an abandoned ceremony costs nobody their invite;
`afterVerification` **burns** it with a single conditional `UPDATE`, so two people racing on one
code produce exactly one account. If writing the account then fails, the burn is released.

The burn writes `used_at` and nothing else. It runs before the account exists — that is the whole
point of the ordering — and `used_by` carries a foreign key to `user`, so naming somebody there
would refuse every registration on an empty instance, the one registration that has to work.
`attributeInvite` fills the name in after the row exists, and is deliberately not load-bearing: if
it never runs, the invite is still spent and the account still exists, and the owner sees a used
invite with nobody's name on it.
Unknown, spent, revoked and expired all answer `invalid_invite`: the form cannot be used to learn
which codes exist.

**Roles.** Better Auth's `admin` plugin supplies the columns (`user.role`, `user.banned`,
`user.ban_reason`, `user.ban_expires`, `session.impersonated_by`). The first account on the
instance is written with `admin`, every later one with `user`. Which account that is gets decided
under an advisory lock by "is the earliest account mine", not by the table being empty: two
ceremonies finishing together would otherwise both become the owner, or — if the question were
asked after the rows were written — neither would. `requireAdmin` answers 401 without a session and
403 with the wrong account.

Saldo calls none of the plugin's own endpoints, but they are served from the `/api/auth` catch-all
and so are part of the surface. They are gated by the plugin's own role check, which
`app/api/auth/adminPlugin.test.ts` pins: an anonymous caller, a member and a **revoked** admin are
all refused `admin/list-users` and `admin/create-user`, and the account `create-user` would have
written does not appear. An admin can still use them, and `create-user` would then make an account
with no invite and no row in `invites` — which is not an escalation, since an admin can mint a code
anyway, but it is the one way into the instance that leaves no trace in the invite table.

**Revocation** keeps the account and everything it wrote: the ban flag stops any new session, and
deleting the session rows kills the bearer already in hand. The plugin's own check runs only when a
session is *created*, so `requireUser` tests the flag on every authenticated request — which is
what makes "a revoked account stops syncing" true at once rather than eventually. Deleting an
account instead is irreversible and takes its `sync_rows` with it, by foreign key.

**Routes** (all admin-only): `POST /api/invites` mints, `GET /api/invites` lists (never a code),
`DELETE /api/invites/{id}` revokes. `/api/health` reports `inviteRequired`.

**CLI**, run on the server against `DATABASE_URL`, and the only thing that works when no account
exists: `pnpm --filter web invite new|list|revoke` and
`pnpm --filter web user list|revoke|restore|promote|delete`. `user promote` is the way back in if
the owner loses the phone holding the only admin passkey.

**Upgrading an instance that predates this section:** accounts created before it have `role = NULL`
and are therefore not admins. Run `pnpm --filter web user promote <id>` once, against the account
that should own the server.

---

## 10. Attachments

- **Capture:** `expo-image-picker` (camera + library, `quality 1`), `expo-document-picker` (PDF). Images are
  processed with `expo-image-manipulator`: longest edge ≤ 2000px, JPEG quality 0.8, EXIF stripped. The result must be
  ≤ 10 MB, otherwise show the error toast "File troppo grande (max 10 MB)".
- **Local store:** `${documentDirectory}attachments/{id}.{jpg|png|pdf}`. The sha256 is computed with `expo-crypto`
  (`digest` on the file bytes).
- **Limits:** max 5 attachments per transaction.
- **Where the blobs live is the server's business, not the app's.** `apps/web` owns an `AttachmentStore` interface
  and picks an implementation from `ATTACHMENT_STORAGE`: `fs` (self-hosting on a disk), `s3` (with a configurable
  endpoint, so Cloudflare R2, MinIO, Backblaze and Hetzner come for free), `vercel-blob`, or `none`. Adding a backend
  is a file in `apps/web`; the app is never rebuilt for it.

  ```ts
  interface AttachmentStore {
    put(key, bytes, meta): Promise<void>;
    get(key): Promise<ReadableStream | null>;
    delete(key): Promise<void>;
    /** Only stores that can hand out direct URLs implement these. */
    presignPut?(key, meta): Promise<PresignedTarget>;
    presignGet?(key): Promise<string>;
  }
  ```

  **Presigning is not an optimisation, it is a requirement**: a serverless function caps its request body at ~4.5 MB
  while an attachment may be 10 MB, so a proxied upload cannot work on Vercel. The client therefore never assumes:
  it asks, and the server answers with the mode it can serve.

- **`ATTACHMENT_STORAGE=none` is a supported configuration**, and the default. Attachments still work: they are
  captured, compressed and kept on the phone, the row syncs like any other, and another device shows the attachment
  as "not available on this device". `/api/health` reports `attachmentsEnabled`, so the app says so instead of
  failing an upload nobody could have prevented.

- **Row sync:** attachment metadata syncs like any entity. Blob transfer is separate:
  - Upload queue: rows with `blobState ∈ {local_only, failed}` **after their metadata has been pushed** — the server
    must already know the row the bytes belong to. The client asks
    `POST /api/attachments/{id}/upload-intent` → `{ mode: 'direct' }` or
    `{ mode: 'presigned', url, method, headers }`, then either `PUT /api/attachments/{id}` (raw body,
    `Content-Type`, `X-Content-SHA256`) or the presigned URL followed by
    `POST /api/attachments/{id}/complete`. The server verifies ownership and size either way; with a presigned
    upload it never sees the bytes, so **the hash is verified by whoever downloads them** against the `sha256`
    already carried by the row.
  - Download: on demand when the viewer or a thumbnail needs a blob this device does not have →
    `GET /api/attachments/{id}` (bearer), which streams or redirects to a presigned URL. Cache locally and verify
    the hash before trusting it.
  - `blobState` (`local_only` | `synced` | `failed`) is a **device-local column** and is deliberately absent from
    `attachmentSchema`: if it synced, a second device would inherit the belief that it holds a file it has never
    seen.
  - Deleting a transaction tombstones its attachments. The server deletes blobs of tombstoned attachments in a
    periodic cleanup (on each push, for rows tombstoned > 7 days ago), late enough for other devices to have
    converged. The client deletes local files after the tombstone syncs (or immediately when there is no server
    storage).
- Thumbnails: `expo-image` with `contentFit="cover"`. PDFs show a document icon tile.

---

## 11. Import & export (logic in `@saldo/core/io`, file glue in `apps/mobile/src/io`)

### 11.1 JSON backup

```json
{
  "format": "saldo-backup",
  "version": 1,
  "exportedAt": "ISO",
  "app": { "version": "x.y.z" },
  "data": {
    "settings": { },
    "accounts": [ ], "categories": [ ], "tags": [ ],
    "transactions": [ ], "recurrences": [ ], "budgets": [ ], "attachments": [ ]
  }
}
```

- All non-deleted rows, validated by core schemas on both export and import.
- **Attachments:** the POC exports a **ZIP** (`fflate`, pure JS) containing `backup.json` + `attachments/{id}.{ext}`
  when the user picks "Backup completo (con allegati)". JSON-only is also offered.
- **Restore:** parse → validate everything (show "N errori" and abort on any invalid row) → confirmation sheet
  ("Sostituisce tutti i dati su questo telefono"). Replace = tombstone all existing rows, then insert the backup rows
  with fresh HLC stamps (so they win on sync), then copy attachment files. Performed in one SQLite transaction
  (files copied before commit into a staging dir, moved after commit).
- Share via `expo-sharing`. Filename: `saldo-backup-YYYY-MM-DD.json|zip`.

### 11.2 CSV export (transactions)

RFC 4180, UTF-8 **with BOM** (Excel), `,` separator, `\r\n` line endings, header row:

```
date,type,amount,currency,account,to_account,category,parent_category,description,note,tags,excluded,recurring,id
2026-04-18,expense,45.00,EUR,Carta,,Carburante,Trasporti,Benzina Q8,,Vacanza|Auto,false,false,0191…
```

- `amount` is positive, with `.` decimal separator and no grouping. `tags` joined with `|`.
- Scope options: current period, or all data.

### 11.3 CSV import

Wizard steps (`ImportWizard`, rendered by `profile/import` and by onboarding's import path, §6.29):

1. **File:** `expo-document-picker` (`text/csv`, `text/comma-separated-values`, `*/*` fallback). Parsed by
   `@saldo/core/io`'s own `parseCsv` (auto-detects `,` `;` `\t` outside quotes, strips a BOM, accepts `\n` and
   `\r\n`) rather than PapaParse: the rules are the ones `toCsv` already writes, and `@saldo/core` imports nothing.
2. **Preset detection:** match headers to a preset: `saldo` (own export, auto-mapped), `spendee`, else `generic`.
3. **Mapping** (generic, or to confirm a preset): required `date`, `amount`; optional `type`, `account`, `category`,
   `description`, `note`, `tags`, `currency`, `excluded`. Options: date format (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`,
   `DD.MM.YYYY`, ISO datetime → local date), decimal separator (`,`/`.`), sign convention (`negative = expense` or
   `type column` with value mapping), default account (when no account column), tag separator.
4. **Preview:** first 20 parsed rows, total rows, errors per row (with reason), accounts/categories/tags to be
   **created**, and duplicates to be skipped.
5. **Confirm → result:** "Importate N · Saltate M duplicati · K errori" + button to view the transactions.

Rules:

- Unknown category names create **expense/income top-level** categories (icon `tag`, colour 9), in the direction of
  the row, so "Money Back" as income and an expense category of the same name can coexist. Every expense and income
  needs a category (§4), so a row whose cell is empty is an error unless the mapping names a **default category** —
  the same shape as the default account. (`Parent > Child` hierarchies are not in the POC: no sampled file uses one.)
- Unknown accounts are created as `checking`, `openingBalance 0` (onboarding passes the opening balances it computed, §6.29), `includeInSpendable true`.
- An account, category or tag the plan lists as new is created only if it is **still missing when the import writes**: rows written after the preview — onboarding's hidden seed categories, or a sync — are reused, not twinned.
- `excluded` sets `excludeFromTotals`: `true`, `1`, `yes` or `sì` (case- and accent-insensitive) exclude the row;
  anything else, an empty cell included, counts. The `saldo` preset maps it, so a round trip of our own export
  (§11.2) keeps excluded rows excluded; the Spendee export has no such column.
- Currency column values ≠ settings currency → row error "Valuta diversa ({code})" (no conversion).
- **Duplicate fingerprint:** `date | amountMinor | kind | normalize(description) | accountName`. `normalize` =
  lowercase, accent-stripped, collapsed whitespace. Skip rows whose fingerprint already exists (in DB or earlier in
  the same file).
- Transfers are not imported at all. The real Spendee export contains only `Expense` and `Income`, so an unknown
  `Type` is reported as a row error naming the value rather than guessed at.
- All inserts happen in a single SQLite transaction; any exception rolls back.

**Spendee preset** — verified against a real export (2026-09-10, 54 rows), anonymised as
`packages/core/src/io/__fixtures__/spendee.csv`. The file is:

```
Date,Wallet,Type,"Category name",Amount,Currency,Note,Labels,Author
2026-08-12T16:23:13+00:00,"My Money",Expense,Travel,-5.00000000,EUR,"aperitivo ",Banca🏦,"A Person"
```

- **No BOM, `\n` endings, `,` separator**, RFC 4180 quoting (only the fields that need it are quoted, and
  `Category name` is quoted in the header because of its space).
- `Date`: ISO-8601 **with an offset**. The first 10 characters are already the local date in that offset, so the
  import takes them verbatim — converting to the device's zone would move evening transactions to the next day.
- `Amount`: signed, `.` separator, **8 decimal places**. Parsed as a decimal string into minor units; never through
  a float (`-0.99000000 * 100` is not `-99`).
- `Type`: `Expense` and `Income` are what the sample contains. **`Transfer` was not observed**, so the importer does
  not guess: an unknown `Type` becomes a row error naming the value, and transfer pairing stays out of the POC.
- `Category name`: flat, no `Parent > Child` (one value contains a comma, hence the quoting). Created in the
  direction of the row's `Type`.
- `Note` → description (trailing spaces trimmed). `Author` is ignored. `Currency` ≠ settings currency → row error.
- `Labels` → tags, and they may be empty or carry emoji. **They can also be where the account really lives**: in the
  sample every row has the same `Wallet` ("My Money") while `Labels` holds `Banca🏦` / `Contanti 💵` / `Carta 💳`.
  The preset therefore proposes `Wallet` → account and `Labels` → tags, and the mapping step (3) must let the user
  point **account** at `Labels` instead, with a default account for the rows whose cell is empty.
- The label separator is unknown: no sampled row has two. It is an option in step 3, defaulting to `,`.

---

## 12. Internationalisation

- `packages/i18n/src/locales/it.ts` is the **source catalog** (strings copied verbatim from the design).
  `en.ts`, `fr.ts`, `de.ts`, `sv.ts`, `es.ts` and `pt.ts` are typed `Messages` and unit-tested against it: same key
  paths, same `{{variables}}` per key. `pt` is European Portuguese; Brazilian devices get it too. The five newer
  catalogs are machine-drafted and each needs a native read before release.
- Keys are namespaced by feature: `common.*`, `tabs.*`, `home.*`, `transactions.*`, `txForm.*`, `stats.*`,
  `budgets.*`, `accounts.*`, `categories.*`, `tags.*`, `settings.*`, `profile.*`, `onboarding.*`, `sync.*`,
  `auth.*`, `import.*`, `export.*`, `errors.*`, `seed.*` (seed category names), `icons.*` (icon search labels).
- Interpolation `{{name}}`. Catalogs write i18next `_one` / `_other` plurals only; `resources` copies each `_other` to
  `_many`, the CLDR category Italian, French, Spanish and Portuguese use for round millions (missing, i18next fell
  back to English). i18next runs `pt` as `pt-PT` so that `0` takes the plural, as in Portugal.
- Quotes: Italian, Spanish and Portuguese «»; French « » with narrow no-break spaces (also before `? ! : ;`);
  German „“; Swedish ”…”; English curly double quotes “ ”.
- Language names are autonyms (`LANGUAGE_NAMES`: Italiano, English, Français, Deutsch, Svenska, Español, Português),
  never translated; the Language screen (§6.8) lists Sistema, Italiano, English, then the rest alphabetically.
- `resolveLocale(preference, deviceLanguages)` → the preference if it is not `system`; otherwise the first device
  language whose language subtag the app speaks (`pt-BR` → `pt`, `de-AT` → `de`, `sv-FI` → `sv`); otherwise `en`.
- Deterministic formatters (`@saldo/i18n/format`): `formatMoney`, `formatMoneyParts`, `formatDayMonth`
  (it `18 apr`, en `Apr 18`, de `18. Apr.`, es `18 abr`), `formatCycleRange` (it `27 mar – 26 apr`, en `Mar 27 – Apr 26`), `formatLongDate`
  (it `18 aprile 2026`, en `April 18, 2026`), `formatPercent`, `formatRelativeTime` (sync status, coarse:
  now / N min / N h / date).
- The formatters read one hand-written `CONVENTIONS` table per locale (CLDR values, no `Intl` at runtime): thousands
  separator (fr U+202F, sv and pt U+00A0, de/es/it `.`, en `,`), CLDR minimum grouping (es and pt leave four digits
  ungrouped: `1234,50 €`), symbol after the amount everywhere but `en`, first weekday (Sunday for `en` and `pt`),
  month and weekday names, and the date patterns (`18 de abril de 2026` in es/pt).
- The mobile app initialises i18next (`react-i18next`) with `resources` from the package and reacts to settings changes.

---

## 13. Theming & visual system

- Tokens come from design lines 14–41 and are exported by `@saldo/ui` (`palettes.dark`, `palettes.light`,
  `categoryColors`, `accentOptions`, `radii`, `spacing`, `fontSize`, `fontWeight`, `tracking`, `motion`, `layout`).
- **The accent is neutral, not the design's orange.** `accent` is the high-contrast grey of its theme
  (`#C7C7C7` on dark, `#4A4A46` on light) and `barGrey` the low-contrast one; the design's `#E8823C` stays
  available in `accentOptions`. Two consequences run through the rest of this spec:
  - Wherever it says "accent when over pace / over limit, grey otherwise" (§5.3 Home bar, §5.7 committed share,
    §5.8 budget bars), the contrast is now **brightness**, not hue. `accent` vs `barGrey` still reads clearly in
    both themes, and a unit test in `@saldo/ui` guards the ratio so a future palette edit cannot collapse it.
  - `positive` (green) becomes the only chromatic signal in the app, which sharpens "below usual = good".
  - The `segments` ramp is a grey ramp, so `segmentOther` sits **outside** it (dimmer on dark, lighter on light)
    instead of reusing `barGrey`; a test asserts no segment equals `segmentOther`. A neutral accent also has to
    invert with `onAccent`, and the contrast of both pairs is unit-tested — a mid grey such as the design's
    `#C7C7C7` in *light* theme would be unreadable behind white text, which is why the two themes differ.
- `ThemeProvider` resolves `settings.theme` (`system` uses `useColorScheme`). Status bar style follows the theme.
- **Typography:** Geist (400/500/600) via `expo-font` (`@expo-google-fonts/geist`, or the variable TTF from the Geist
  repo bundled in `apps/mobile/assets/fonts` if the package is unavailable). Letter-spacing in the design is in `em`;
  convert with `tracking(em, fontSize) = em × fontSize` px.
- **Icons:** `@saldo/ui` exports `iconNodes[name]`: parsed `{ tag, attrs }[]`. The mobile `<Icon name size color />`
  renders `react-native-svg` elements with `viewBox 0 0 24 24`, `fill none`, `stroke currentColor`, `strokeWidth 1.5`,
  round caps/joins, and per-node attribute overrides (for example `fill="currentColor"`). Default size 18.
- **Tint helpers:** `withAlpha(hex, a)` for category tints (design uses `+22`, `+24`, `+2E` suffixes ≈ 0.13, 0.14, 0.18).
- **Motion:** respect "Reduce motion" (`AccessibilityInfo.isReduceMotionEnabled`), which swaps slides for fades.
- **Empty states** (`EmptyState`, tokens `emptyState` and `palette.ghost*`): three shapes. **Nothing yet** draws
  three ghost layers of the missing row/bar/chips, tilted in perspective and fanned in (520ms, 60ms stagger),
  compressed while its CTA is pressed. **Nothing matches** (a filter or a period) only fades in. **Not found**
  (`NotFoundScreen`, a record deleted or not yet synced) does not move. Every one carries an action. Ghosts are
  sibling views with their own perspective, because React Native has no `preserve-3d`. On dark they use
  `raised`/`borderStrong`, because `surface`/`border` vanish into `bg`. In-card empties (Home recent, account recent,
  Stats split, the Home budget card) stay a muted line.
- **Mascot** (D26; `Mascot`, `MascotPeek`, `MascotCelebrate`, token `mascot`): Rocky, the raccoon of the app icon, as
  the mascot kit's Lottie states (`lottie-react-native`), copied into `apps/mobile/assets/mascot/<state>.json` from
  `out/saldo/animations/` of github.com/saliougaye/mascots. `Mascot` plays one state:
  - `loading` and `sleep` loop; `idle`, `success`, `error` and `wave` play once from frame 0 to the state's **pose
    frame** and stop there. The pose frame is the kit's `pose_time` (60% of the loop unless the spec sets one):
    `idle` 86, `success` 43, `error` 43, `wave` 45, `loading` 86, `sleep` 42, at 30 fps. It is the frame the kit's
    stills are cut from, so a stopped Rocky is the kit's still.
  - Reduce Motion shows the pose frame and plays nothing, loops included.

  Seven places:
  - **Nothing yet** (`EmptyState` `kind: 'yet'`): Rocky (`idle`) peeks over the back of the ghost stack, which stays.
    The window he rises in is clipped at the back ghost's edge, since the ghosts are translucent. He rises
    `mascot.peekFromRatio` of his height after the stack has fanned in.
  - **A reached goal, still open** (§6.35, §6.36): Rocky (`success`) peeks over the top edge of its card, near the
    trailing corner. It is a state, not an event: he is there on every visit until the goal is closed, and he does not
    rise again on a screen that is already open. Home's target card (§5.13) has none: Home is seen many times a day.
  - **Closing a reached goal** (§6.38): Rocky (`success`) whole above «Hai usato i soldi?», arriving with the only
    overshoot in the app. A goal closed before its target has no Rocky.
  - **Welcome** (§6.29 step 0): Rocky (`wave`) whole above the title, `mascot.welcomeSize`.
  - **Lock screen** (§6.32): Rocky (`sleep`) in place of the shield icon, `mascot.lockSize`, looping until unlocked.
  - **A long wait** (`LoadingScreen` with a `label`, today the first sync): Rocky (`loading`) in place of the spinner,
    `mascot.loadingSize`, looping. Without a label (migrations, the i18n bundle, the first settings read) the spinner
    stays: those waits are too short for him to arrive and leave.
  - **A failed import or restore** (§11.1, §11.3; `ErrorNote`): Rocky (`error`) small above the inline message,
    `mascot.errorSize`, one play. The message is unchanged and still says what went wrong.

  Never in «nothing matches», «not found», toasts, the pull-to-refresh, the sync status or any other error. He is
  decoration: hidden from screen readers, never the only cue (the title, the bar, the sheet's text, the message say
  the same). Reduce Motion puts him in place without rising or arriving.
- **Accessibility:** minimum hit area 44×44 (use `hitSlop` on 32–34px buttons), `accessibilityLabel` on icon-only
  buttons (i18n keys), amounts read as full currency strings, and toggles expose `accessibilityRole="switch"` with state.

---

## 14. Server (`apps/web`)

- Next.js App Router, `output: 'standalone'`, `transpilePackages: ['@saldo/core', '@saldo/i18n', '@saldo/ui']`.
- Route handlers under `app/api/**/route.ts`. All handlers use `runtime = 'nodejs'`.
- Layers: `src/server/db` (Drizzle `node-postgres` schema + migrations via `drizzle-kit`), `src/server/auth`
  (webauthn, tokens, PKCE, rate limit), `src/server/sync` (push/pull services), `src/server/storage`
  (`BlobStorage` interface + `FsBlobStorage`), `src/server/http` (JSON error helpers, `requireUser(req)`).
- Error format: `{ "error": { "code": "string", "message": "string" } }` with proper HTTP status codes.
- **Endpoints:**

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | – |
| POST | `/api/auth/register/options` · `/api/auth/register/verify` | – |
| POST | `/api/auth/login/options` · `/api/auth/login/verify` | – |
| POST | `/api/auth/token` · `/api/auth/logout` | – (body tokens) |
| GET | `/api/me` | bearer |
| POST | `/api/sync/push` · GET `/api/sync/pull` | bearer |
| GET/DELETE | `/api/data` | bearer |
| PUT/GET | `/api/attachments/[id]` | bearer |
| GET | `/auth/mobile` (page) | – |
| GET | `/` (page) | – simple landing: "Saldo server is running", version, link to repo |

- **Docker:** `apps/web/docker/Dockerfile` (multi-stage, pnpm `turbo prune web --docker`), `docker-compose.yml`
  with `postgres:17` + `web` + volume for `STORAGE_DIR`, and a `Caddyfile.example` for automatic HTTPS. Migrations
  run on container start (`node dist/migrate.js` or `drizzle-kit migrate` in an entrypoint).
- **Dev:** `pnpm --filter web dev`; Postgres via compose. For phone testing over HTTPS use a Cloudflare Tunnel or
  Tailscale Funnel (documented).

---

## 15. Build & sideload

`apps/mobile/app.config.ts` reads:

| Env | Default |
| --- | --- |
| `SALDO_APP_NAME` | `Saldo` |
| `SALDO_BUNDLE_ID` | `io.github.saldo.app` (forks must change it) |
| `SALDO_SCHEME` | `saldo` |

The server is not a build input: the app starts without one and asks for its address (§6.29 step 0, §6.30). The
server has to list the build's `SALDO_SCHEME` in `APP_REDIRECT_SCHEMES` (§9.3).

**Android APK (docs/building-android.md):**

1. Prerequisites: JDK 17, Android SDK + platform tools, `ANDROID_HOME`.
2. `pnpm install` then
   `pnpm --filter mobile exec expo prebuild --platform android --clean`.
3. Generate a keystore: `keytool -genkeypair -v -storetype PKCS12 -keystore saldo-release.keystore -alias saldo -keyalg RSA -keysize 2048 -validity 10000`.
4. Put `SALDO_UPLOAD_STORE_FILE`, `SALDO_UPLOAD_KEY_ALIAS`, `SALDO_UPLOAD_STORE_PASSWORD`, `SALDO_UPLOAD_KEY_PASSWORD`
   in `~/.gradle/gradle.properties`. A config plugin in `apps/mobile/plugins/withReleaseSigning.js` wires
   `signingConfigs.release` so it survives `prebuild --clean`.
5. `cd apps/mobile/android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk`.
6. Install: `adb install -r app-release.apk`, or copy it to the phone and allow "install unknown apps".
7. Convenience script: `pnpm --filter mobile build:android`.

**iOS (docs/building-ios.md):**

1. Prerequisites: macOS, Xcode (current), CocoaPods, an Apple ID.
2. `SALDO_BUNDLE_ID=com.<you>.saldo pnpm --filter mobile exec expo prebuild --platform ios --clean`.
3. Open `apps/mobile/ios/Saldo.xcworkspace`, then Signing & Capabilities → Team: your Personal Team.
4. Select the device and run with the **Release** scheme configuration (Product → Scheme → Edit Scheme → Run → Release).
5. **Free Apple ID limits:** the app expires after 7 days (re-run from Xcode) and you can have 3 sideloaded apps. A paid
   developer account gives 1-year profiles. Alternatives: AltStore/SideStore (auto-refresh).
6. Enable Developer Mode on the device (Settings → Privacy & Security).

`android/` and `ios/` are generated (Continuous Native Generation) and **git-ignored**.

---

## 16. Testing strategy

| Layer | Tooling | Required coverage |
| --- | --- | --- |
| `@saldo/core` | Vitest | Every exported function has unit tests; formulas in §5 have example-based tests using design mock numbers; HLC and LWW merge have property-style tests (random interleavings converge). Target ≥ 90% lines. |
| `@saldo/i18n` | Vitest | Catalog key parity it/en; formatter outputs for both locales. |
| `@saldo/ui` | Vitest | Token palette parity dark/light; all 74 icons parse. |
| `apps/web` | Vitest + PGlite + Drizzle | Route handlers called directly with `Request` objects: auth code/PKCE/refresh rotation/reuse detection; sync push/pull LWW, stale, invalid, pagination; attachment PUT/GET ownership + hash mismatch. WebAuthn verification is mocked at the `@simplewebauthn/server` boundary. |
| `apps/mobile` | jest-expo + RNTL | Repositories against an in-memory SQLite (`expo-sqlite` mock or `better-sqlite3` adapter in tests); keypad, swipe thresholds, transaction form validation, import wizard mapping; sync client against a fake server. |
| E2E (optional) | Maestro flows in `apps/mobile/maestro/` | Onboarding → add expense → see Home update; edit recurring "this and following". |

CI (`.github/workflows/ci.yml`): pnpm install (frozen lockfile), `pnpm lint`, `pnpm typecheck`, `pnpm test`. No native builds in CI.

---

## 17. Future iterations (not POC; keep extension points)

### 17.1 Web app (milestone 0.3, decided 2026-09-26)

The browser gets Saldo. This is how the app reaches people without a sideload: every instance serves a web app
that a user can also install to the home screen as a PWA, so an App Store build is not a precondition for going
public. The decisions behind this section are D30–D36.

#### 17.1.1 Where it lives

- The web app is the **root of the instance**, in `apps/web`. `/` redirects to `/home` with a session and to
  `/login` without one. `/api/**` and `/auth/mobile` keep their paths. The «Saldo server is running» landing page
  goes away; the login page shows the version in its footer instead.
- **Why not a subdomain:** a passkey is bound to `WEBAUTHN_RP_ID`. On the same origin the phone's passkey works
  on the web with no configuration; a subdomain would ask every self-hoster for a second DNS record, a second
  certificate, a shared cookie domain and a parent-domain RP id.
- `/admin/**` is the admin panel (§17.1.8). The public marketing site and docs library are **not** here: they are
  their own app, `apps/site`, with their own deploy (D35, roadmap 0.8).
- Routes in 0.3: `/login`, `/register`, `/recover`, `/recover/confirm`, `/email-verified`, `/onboarding`, `/home`,
  `/transactions`, `/stats`, `/profile`, `/admin/**`, `/setup` (0.3h, only while the instance has no account).

#### 17.1.2 The projection: the only way server code reads rows

- `apps/web/src/server/userData/` loads a user's live rows from `sync_rows` (tombstones excluded), parses each
  with `entitySchemas[entity]` and returns a typed `UserData` (`settings`, `accounts`, `categories`, `tags`,
  `transactions`, `recurrences`, `budgets`, `attachments`). `UserData` is the shape the backup already has
  (`BackupData`, §11.1), moved to `@saldo/core` so that the backup, the web, MCP and AI share one type. The server
  may hold no `settings` row yet (before onboarding); how `UserData` says so is settled in the plan.
- Pages hand the `UserData` to the same `@saldo/core` functions the phone calls: period bounds, totals, budgets,
  target cards, statistics, the forecast. **No calculation is written twice**; if the web shows a number the phone
  does not, one of them is wrong.
- **A row that fails validation is skipped and logged, never fatal.** Push already refuses a row that does not parse,
  so a stored row fails only when the schema has changed under it: a server rolled back to an older release, a
  field added without `.optional()` or a rule tightened, a hand edit of the database. The row stays in `sync_rows`
  and on the phone, which skips it the same way on pull (§8.1). Unknown fields are stripped by Zod. One bad row
  never breaks a page. Counting skipped rows for the admin, a notice to the user and a regression test on stored
  rows are **deferred** until this happens in practice: every read goes through the projection, so adding them
  changes one module. `settings` is the exception, below.
- **`settings` is never skipped: it is read with a default for every field.** A missing or invalid field falls back
  to `language: 'system'`, `theme: 'system'`, `periodKind: 'month'`, `cycleStartDay: 27`, `currency: 'EUR'`, and
  `timeZone` to `TZ` (§17.1.5). `UserData.settings` is `Settings | null`, and only `null` (no row, or a tombstone)
  sends the user to `/onboarding`. Skipping an unreadable row instead would look like «never onboarded», and
  onboarding would write a new `settings` over the real one. The defaults live in a read-only schema used by the
  projection; `entitySchemas` stays strict, because push validates with it and stores `data` as sent. Known cost: a
  settings form on the web writes the whole row back, so a defaulted field (a language an older server does not
  know) replaces the real value on every device. Accepted: it needs a server rollback first.
- Push and pull keep moving envelopes without looking inside `data`; everything else that needs a row's contents
  goes through the projection. The projection may also read a single row where loading everything would be absurd:
  the attachment check of §10 (`requireAttachment`, today in `server/attachments/row.ts`) moves into it as
  `loadAttachment(db, userId, id)`, which returns `found`, `missing` or `invalid`; `requireAttachment` stays as the HTTP
  wrapper. The rule is kept by review, not by a lint or a test.
- **Storage stays `sync_rows` (D11 confirmed 2026-09-26), and the projection loads all of the user's data on every
  request**, as the phone already does from SQLite (`repos.transactions.list()`). This is a known limit, not an
  oversight: a few years of data is tens of thousands of rows, parsed and validated per page. When it starts to show,
  the options are, in order of cost: a cache keyed on the user's highest `seq`; loading transactions by date window
  through generated columns on `sync_rows` (`date`, `account_id`, `kind`, `amount`) with an index, and balances as a
  SQL sum pinned to `accountBalances` by a parity test; typed relational tables in place of `sync_rows`. Pages ask the
  projection for data and never touch storage. The cache and relational tables change the projection alone; loading
  by date window also changes what pages ask for, because the API in 0.3 is one call that returns everything.
- **One call, loaded once per request.** `loadUserData(userId)` returns the whole `UserData`, wrapped in React's
  `cache()` so a layout and a page in the same request share one load. No query-shaped API in 0.3: core's functions
  take whole arrays, and balances and the forecast read the whole history anyway.
  **As built (0.3d):** that one call is what every read screen uses — Home, Transazioni, Statistiche, Conti and
  Profilo each reach it through `readPage`, which resolves the session, loads the data and derives «today» once; the
  `(app)` shell reads the same `UserData` for the top bar's name, role and theme, and pays nothing for it because
  `cache()` has already resolved it for the page in the same request. The screens never ask storage anything else:
  a page that needs a figure the projection does not carry is a core function that has not been called yet.
  The limit this section warns about now has a number beside it: the development account holds **141 live rows**
  (92 transactions, 20 categories, 12 recurrences, 7 accounts, 5 budgets, 4 tags, 1 settings), parsed and validated
  on every request with no measurable cost. That is a seeded account, not years of history — the point of recording
  it is that the first real account to feel this will be one or two orders of magnitude above it, which is where the
  cache keyed on the user's highest `seq` becomes the next step.
- **Recurring occurrences are not materialised by the server in 0.3.** The web shows the occurrences a phone has
  already generated and synced. Server-side materialisation is an open question for a later milestone.

#### 17.1.3 Writes from the web: the server as a sync client

- The web writes **transactions, accounts (including pockets and their goals), categories, tags, budgets and
  settings**. It does **not** create or edit recurrences and does not upload attachments in 0.3; both stay on the
  phone.
- A write is a Server Action that builds the entity with the same `@saldo/core` functions and validation as the
  phone's forms, stamps it with a server HLC, and applies it through the **same upsert as `POST /api/sync/push`**,
  which assigns a `seq`. The phone receives it on its next pull. Deletes are tombstones. Conflicts resolve by LWW,
  exactly as between two phones.
- **Server clock:** one HLC per instance, whose state (last wall time, counter) lives in a single-row table and is
  advanced under a row lock. Its `deviceId` is a stable instance id generated on first start, so its writes can be
  told apart and tie-breaks stay deterministic.
- **Onboarding on the web:** an account with no `settings` row goes to `/onboarding` (currency, period kind and
  cycle day, as on the phone), which writes `settings` and the seed data of §4.2. `settings` itself cannot clash: a phone
  that brings its local rows into an account yields its `settings` to the account's (`yieldSettingsToAccount`,
  §9.3). The seed can: seed rows from the web and from a phone that onboarded offline have different ids, so both
  survive the merge. Resolved in the plan; the lead option is deterministic ids for seed rows on both sides.

**As built (0.3e-1, 2026-09-29):**

- **The clock is the `server_clock` table** (`apps/web/src/server/write/clock.ts`): one row (`id` 1, `device_id`,
  `wall_ms`, `counter`), created on the first write with `device_id = server-{uuid}` and locked `FOR UPDATE` for the
  rest of the write's transaction, so two writes never mint the same stamp. It is instance-wide, not per user.
  `advanceClock` is `lockClock` + `mintStamps` (pure) + `saveClock`.
- **Receive before stamp.** A phone's HLC may run up to 24h ahead of the server (§8.2). Stamped with `hlcNow` alone,
  a web edit of a row the phone wrote would lose the upsert's `updated_at < excluded.updated_at` test and be dropped
  as `stale` without a word. So for each row the clock first **receives** its current `updated_at`
  (`hlcReceive`), and the stamp is always after it.
- **`writeChanges` is the one write path** (`src/server/write/writeChanges.ts`); nothing else writes `sync_rows`.
  `writeInTransaction(db, userId, now, build)` opens the transaction, takes the push route's epoch share lock, runs
  `build(tx)` — whose reads (`readUserData`, `loadRow`) happen on that same transaction — then locks the clock, then
  each target row `FOR UPDATE` in (entity, id) order, mints the stamps and hands the batch to `applyPush`, the upsert
  `POST /api/sync/push` runs. The epoch lock is a *share* lock, so a phone's push can still commit a row between
  `build`'s read and the row lock: each write therefore carries its **`basis`**, the `updatedAt` `build` read (`null`
  for a row it creates), and a locked row whose `updated_at` differs — or a "new" row that now exists — refuses the
  batch as a `conflict`, instead of overwriting the phone's edit unseen. A write with no `basis` is blind and LWW
  decides (onboarding's seed rows, which converge by id on purpose). Anything but `applied` throws `WriteRefused` and
  rolls the whole batch back; the Server Actions answer `invalid` when a row failed its schema and `conflict`
  otherwise. `writeChanges` is the wrapper for a caller with nothing to read first.
- **`loadRow`** (`src/server/userData/row.ts`) reads one row **tombstones included** — the one thing the projection
  cannot answer. «Annulla» after a delete writes that row back with `deletedAt: null` and a new stamp, and only for a
  tombstone deleted in the last 10 minutes.
- **The seed** (`@saldo/core` `seed.ts`, shared with the phone): every seed category's id is
  `seed-category-{nameKey}` on both sides, so an offline phone onboarding and a web onboarding of the same account
  converge on one row per category by LWW. The **first account keeps a random id**: two onboardings that named two
  accounts described two accounts, and merging them would lose one. `settings` already converges (`id: 'settings'`).
  `finishWebOnboarding` writes settings, the account and the seed in one `writeInTransaction`.

**As built (0.3e-2, 2026-09-30):**

- **Three more write modules, all on `writeInTransaction`** (`apps/web/src/server/write/`): `accounts.ts`
  (`saveAccount`, `archiveAccount`, `restoreAccount`), `goals.ts` (`saveGoal`, `closeGoal`, `restoreGoal`) and
  `budgets.ts` (`saveBudget`, `deleteBudget`). Each reads with the projection on the write's own transaction and carries
  the `basis` of every row it edits. Refusals are values, never throws: `AccountWriteError` adds `holdsGoals` (an
  account with open goals cannot be archived) and `parentArchived` (a goal's account is archived) to the common
  `invalid`/`notFound`/`conflict`; `BudgetWriteError` adds `taken` (a category already in another budget).
  `saveAccount` answers `notFound` for a pocket id: the goal form is the only door to a pocket.
- **The account form edits the current balance** (§6.22); the server turns it into an opening balance with
  `openingBalanceForCurrent` over the whole ledger, as the phone does. A new account's typed balance is its opening
  balance. The buffer is checked by `signedBufferOk` (`amounts.ts`).
- **A goal is created with `openingBalance: 0`**; «Già da parte» becomes a transfer from the parent account, never an
  opening balance (it would count the money twice in Patrimonio, §5.14).
- **`closeGoalWrites`** (`goals.ts`) is the whole of closing a goal as a list of writes: the tombstones of its future
  rows, the recurrence edits and deletes `planStopRecurrence` returns, the settlement transfer that takes the pocket to
  exactly zero, and the pocket's `archivedAt`. `closeGoal` applies them as **one** `writeInTransaction`, so a close is
  all or nothing and its rows take consecutive `seq`s.
- **`saveTransaction` gains an optional `closeGoalId`** («Registra la spesa»): validated as an open pocket that is the
  form's account, then `closeGoalWrites` are appended to the expense's own writes in the same transaction.
- **What moved into `@saldo/core`** so the phone and the web run one set of rules (no re-export shims; the phone
  imports them from core): `views/accountForm.ts`, `views/goalForm.ts` and `views/budgetForm.ts` (the forms' pure
  half, `icon: string` because core imports no other workspace package) and `goalPlans.ts` (`newGoalFields`,
  `newGoalTransferFields`, `planCloseGoal`, `restoreGoalFields`, `canRestoreGoal`). The phone's `goalService.ts` is a
  thin caller of the plans and its test was not edited.
- **The budget's suggested amount** is computed in the browser from the six past periods' spend as plain numbers,
  with core's `suggestBudgetAmount` and the phone's 12% headroom.

**As built (0.3e-2b, 2026-09-30):**

- **`categories.ts`** (`apps/web/src/server/write/`): `saveCategory`, `archiveCategory`, `restoreCategory` and
  `reorderCategory`, on `writeInTransaction` with the `basis` of every row read. `CategoryWriteError` adds
  `parentInvalid` and `moveInvalid` to the common errors. The phone's rules are re-checked on the server: a child
  cannot have children, the parent is live, top-level, of the same direction and not the category itself; archiving a
  parent archives its children; **archive with a move is one batch** that rewrites `categoryId` on every live
  transaction and recurrence template that uses the category and the `categoryIds` of every budget (deduplicated),
  the target being live, of the same direction and neither the category nor one of its children; a child whose parent
  is archived cannot be restored; reorder renumbers one sibling group and writes nothing for a move past either end.
  «Budget mensile» on the form creates a single-category `period` budget named after the category (alert 90, no
  rollover) or updates that budget's amount, and switching it off (or an amount of 0) removes an existing
  single-category budget, as the phone's edit does. Income categories never get one.
- The form's pure half (`CategoryFormValues`, `categoryFormFrom`, `categoryMissingForSave`) moved into `@saldo/core`
  `views/categoryForm.ts`, with `categoryParentCandidates` and `movableTargets`.

**As built (0.3e-3, 2026-09-30):**

- **`settings.ts`** (`apps/web/src/server/write/`): `saveSetting` takes **one preference at a time** — `language`,
  `theme`, `currency`, `cycleStartDay` (1–28, narrower than the entity's schema) or `timeZone` — and writes the
  settings row back with that field changed and the row's `basis`. No settings row is `notFound` (a preference does not
  onboard an account); a value already stored writes nothing. The time zone is checked with `isTimeZone` and stored
  under the id the list holds (`canonicalTimeZone`: `Asia/Kolkata` is saved as `Asia/Calcutta`); a settings row with no
  `timeZone` yet is handled. `periodKind` is not writable.
- **`tags.ts`**: `createTag` (moved from `transactions.ts`; the transaction form's «Crea «X»» — it answers the tag that
  already has the name, with `created: false`), `newTag` (Profilo's «Nuovo tag»: a name in use is refused as `taken`),
  `renameTag` (keeps the id; its own name or a change of case only is allowed, the same name writes nothing),
  `mergeTags` and `deleteTag`. Merge and delete are **one batch** each: every live transaction **and recurrence
  template** carrying the tag is rewritten (the target replaces the source, deduplicated; or the id is removed) with
  its `basis`, and the tag is tombstoned in the same `writeInTransaction`.
- **Export** is two route handlers, not Server Actions: `GET /api/export/backup` and
  `GET /api/export/csv?range=all|period&p=<date>` (`app/api/export/`, shared start in
  `src/server/export/exportRequest.ts`). They authenticate with `requireUser`, so the browser's cookie and a bearer
  token are both accepted — the same user could read the same rows through `/api/sync/pull` — and answer 401 without a
  session, 409 `nothing_to_export` without settings, 400 `invalid_query` for an unreadable `range` or `p` (a file that
  silently covers something else is worse than none). The response is `Content-Disposition: attachment` with the
  phone's file names (`saldo-backup-{today}.json`, `saldo-transactions-{today}.csv`, «today» being the user's, §17.1.5)
  and `Cache-Control: no-store`.
- **`@saldo/core` `io/exportFiles.ts`**: `backupFile`, `csvFile`, `ExportFile` and `NothingToExportError` moved out of
  the phone's `exportService.ts`, which now only collects its rows and zips. Both sides therefore write the same file —
  same sort (newest first, id within a day), same CSV guard (§18) — and a backup taken on the web restores on the phone.
- **No way in but a passkey.** 0.3e-1 to 0.3e-3 were checked in a browser through a temporary, loopback-only route that
  signed the browser in as an existing account; it was deleted when 0.3e closed. A UI check in a browser now needs a
  real passkey (§17.1.4); route handlers are tested with a session row and its signed cookie
  (`src/server/test/session.ts`).

#### 17.1.4 Authentication on the web

- Same Better Auth instance. The web uses its **cookie session**; the phone keeps its bearer token.
  `requireUser` accepts either. A revoked user's session is refused on the next request.
- `/login`: passkey sign-in, with the browser's conditional UI (passkey autofill) where it is supported. Signing
  in with the phone's passkey from a desktop uses the browser's cross-device (QR) flow, which WebAuthn provides.
- `/register`: **email** plus the invite code when `REGISTRATION=invite`, then the passkey ceremony. The same
  email field is added to the phone's registration page at `/auth/mobile`. The page is in steps and checks the code before the ceremony
  (§17.1.7, auth pages).
- **Email is required from now on (D32)** and replaces the synthetic `{id}@passkey.saldo.invalid` of §9.1. It is
  lowercased and unique. It is an identifier (how an admin, and later shared finances, know who somebody is),
  **not a credential**: signing in stays passkey-only.
- **Verification and recovery need SMTP, registration does not.** When the admin has configured SMTP
  (§17.1.8), the server sends a verification link and offers **account recovery** by magic link to a verified
  address, which then lets the user register a new passkey. Without SMTP the email stays unverified and there is
  no recovery. Recovery makes the mailbox as strong as the passkey; `SECURITY.md` says so.
- `/profile` lists the account's passkeys, and lets the user add, rename and delete them (never the last one),
  and sign out.
- CSRF: Server Actions check the origin; Better Auth checks its own endpoints' origin against `PUBLIC_URL`. Next
  compares `Origin` with `Host`, which is wrong behind a proxy that rewrites `Host`, so the origin is also named
  outright: `experimental.serverActions.allowedOrigins` from `PUBLIC_URL` (it is still an experimental key in Next 16).
  The app's pages carry the same CSP as `/auth/**`, plus `form-action 'self'`, which a Server Action's POST needs.

**Settled while building 0.3b (2026-09-28):**

- **The invite check is `POST /api/auth/invite/check`**, an endpoint of a small Better Auth plugin rather than a route
  of our own, so it inherits the instance's rate limiter, its trusted-proxy IP resolution and its origin handling
  instead of growing a second set beside them. Its own rule is 10 per minute per IP. It answers
  `403 {"code":"invalid_invite"}` for unknown, spent, revoked and expired codes alike, and never spends the code:
  `resolveUser` checks it again and registration is what burns it, so a caller who skips the endpoint gains nothing.
- **«This email already has an account» is shown on purpose.** It tells a caller which addresses have accounts, which
  is what the design's step 1 asks for; the alternative — one vague refusal — would send somebody who forgot they had
  registered to the admin instead of to `/login`. Bounded: the endpoint is rate-limited, an `invite` or `closed`
  instance refuses before it answers, and on an `open` instance a caller learns the same by trying to register.
- **«In uso ora» comes from the browser, not the server.** No table links a session to the credential that created
  it, so the sign-in and add-passkey ceremonies keep the credential id in `localStorage` (`saldo.lastPasskeyId`) and
  the page marks the row whose `credentialID` matches. It is the honest reading of «the one that signed **this
  browser** in», and it costs no column.
- **Passkey management is `/profile/passkeys` from 0.3b**, in the plain page shell; 0.3d wraps it in Profilo's
  sub-navigation and trailing panel rather than moving it. Renaming refuses an empty name — Better Auth validates
  `name` with `min(1)`, and a row with no label already shows its authenticator's name.
- **`afterVerification` must recognise an account that already exists.** With a session the passkey plugin skips
  `resolveUser` and still calls `afterVerification`, which is exactly what «add a passkey» does; without the early
  return it would re-check the registration policy, burn an invite and try to create a row that is already there.
  Nothing exercised that path before 0.3b, so it was a latent bug this step fixed.

**As built (0.3f-3, 2026-10-01):**

- **Better Auth does both**: its core `emailVerification` and its `magicLink` plugin (no new table, no migration).
  Saldo supplies the send callbacks, which resolve SMTP at call time, decide who may be mailed and throttle per
  recipient, and the pages around them. The browser calls the library's endpoints through `authClient`, so both
  flows sit behind the instance's one rate limiter and origin check.
- **Verification.** A new account, and an address filled by `POST /api/me/email`, is sent a link (24 hours,
  `autoSignInAfterVerification: false`: opening a link never signs a browser in) whose callback is
  `/email-verified`, a public page («Email verificata», or, with `?error=`, «Il link è scaduto o non è valido»).
  Profilo → Account shows «verificata» / «non verificata» and, with SMTP and a real unverified address, «Invia il
  link di verifica»; without SMTP it says the address stays unverified. A mail failure never fails a registration.
  Verification is not required to use the app.
- **Recovery.** With SMTP configured, `/login` offers «Hai perso la passkey?» → `/recover` (the phone's `/auth/mobile`
  carries a line pointing to `{host}/recover` in a browser). `POST /sign-in/magic-link` mails a link **only** when
  the account exists, its address is **verified**, it is **not revoked** and the throttle allows it. Every other case
  does nothing, silently, and the page gives the same sentence whatever the address: **no enumeration**, and the
  send is not awaited (`inBackground`, `after()` in a request scope), so the response time does not tell either.
  `magicLink` is configured `disableSignUp: true` (otherwise its verify endpoint would create an account for an
  unknown address, round the registration policy and the invites), `storeToken: 'hashed'`, `expiresIn` 15 minutes,
  single-use.
- **The confirm step.** The mailed link is `{PUBLIC_URL}/recover/confirm?token=…`, a public page that consumes
  nothing and shows a button. Only the button navigates to the library's `GET /api/auth/magic-link/verify`, which
  spends the token and sets the session. A mail scanner that follows links, or another site that makes the browser
  GET a link, therefore cannot spend it or sign a browser in to an account the person did not choose. The browser
  lands on `/profile/passkeys?recovered`, whose alert names the signed-in email and asks for a new passkey; the
  lost one is deleted from the same list.
- **Fixed callbacks.** The link's callbacks are built by the server from the token alone. `mailCallbackGuard`
  (`hooks.before`) refuses, with 403, any `callbackURL`, `errorCallbackURL` or `newUserCallbackURL` that is not a
  path on this site (no scheme, no `//`, no control characters) on `/sign-in/magic-link`,
  `/send-verification-email`, `/magic-link/verify` and `/verify-email`. Without it the session cookie of a verify
  could be carried to an attacker's `saldo://` or off-site URL. The mobile app calls none of these endpoints.
- **A revoked account cannot recover**: it is not mailed, and a link minted before the revocation dies too, because
  the `admin` plugin refuses a session for a banned user; an `hooks.after` turns that into a redirect to
  `/recover?error=BANNED_USER` (the page's «il link non funziona più» line, no JSON). A revoked account is not
  sent verification mail either.
- **Per-recipient throttle** (`server/mail/throttle.ts`): at most one message per kind per address per 60 seconds and
  five per hour whatever the kinds, asked only after an account qualifies. In memory and per process, like the rate
  limiter.
- **Mail** is plain text in the recipient's `settings.language` (else the request's `Accept-Language`, else `en`):
  what it is, the link alone on its own line, how long it lasts, and «if you did not ask for this, ignore it».

**As built (0.3h, 2026-10-03):**

- **First-run setup.** While the instance has no `user` row, `/`, `/login` and `/register` redirect to
  `/setup`: Benvenuto (version, database, no account), Il tuo server (instance name, registration mode;
  a value set by `INSTANCE_NAME` or `REGISTRATION` is shown locked), Il tuo account (name, email, the
  passkey ceremony: the first account, which `claimRoleForNewUser` makes the admin), Pronto (summary,
  the email status — «configurata dall'ambiente», «configurata» or «non configurata» with a link to
  `/admin/settings?edit=smtp` — and, under `invite`, an optional first invite minted with the session the
  ceremony created). The server step writes `server_settings` only where the environment does not set
  the value, guarded by «no account exists» rather than a session. Once an account exists `/setup`
  redirects to `/`.
- **The policy lets the first account in under every mode, with no code.** `registrationAllowed` is
  true and `registrationRequiresInvite` false while `userCount` is zero. This is what retires the CLI's
  first invite; the window is the one `first-user` always had and closes with the first account. The
  CLI (`invite`, `user`) stays for the day no admin can sign in. No SMTP step (decision of 2026-10-01).

#### 17.1.5 «Today» on the server

- The server derives `today` as a `LocalDate` in the user's `settings.timeZone` (§4.1) and injects it into core,
  as the phone does with its own clock. The same zone serves the web, MCP (0.4) and AI (0.5), which have no
  browser to ask (D37).
- The zone is filled at onboarding from the device (the phone's, or the browser's
  `Intl.DateTimeFormat().resolvedOptions().timeZone` on `/onboarding`) and changed only from Profile, on the phone
  or the web. It does not follow the device when the user travels: a period closes where the user lives.
- Fallback when the field is absent (a user onboarded before it existed) or not a zone `Intl` recognises (a
  renamed zone, a hand edit): the instance's time zone, a new optional `DEFAULT_TIME_ZONE` variable that defaults to UTC (not
  `TZ`: Vercel reserves that name, and in Node it also moves the process's local time). An
  invalid name is logged and never breaks a page.
- The conversion from an instant to a wall clock in a zone lives in `@saldo/i18n` (`wallClock`, it needs `Intl`),
  not in core: the server's «today» and the phone's time-zone screen share it.

#### 17.1.6 Preferences

The web reads the user's preferences from the synced `settings` row (language, currency, period kind, cycle day,
theme, time zone) and writes them back there. There are no web-only preferences. What is
device-local on the phone (hidden mode, the lock) does not exist on the web in 0.3.

#### 17.1.7 Interface

- DOM components styled with **CSS Modules**; dialogs, popovers, selects, menus and toasts are built on the
  headless primitives of **Base UI** (`@base-ui/react`), which bring focus management, keyboard handling and ARIA,
  and expose the enter/exit states (`data-starting-style`, `data-ending-style`, `--transform-origin`) the styles
  animate. No component library supplies a look: shadcn/ui and Tailwind were considered and not taken (D34).
  Base UI is added by 0.3b, the first step that renders one of them (`@base-ui/react`, whose namespaced parts —
  `Dialog.Root`, `Popup`, `AlertDialog.Description` — the passkey dialogs use).
- **Strings are resolved on the server.** `@saldo/i18n` gains `makeTranslator(messages)` — dotted paths, `{{var}}`
  interpolation, and the key itself when a string is missing — and there is no react-i18next on the web and no catalog
  in the browser bundle: a client component receives the handful of strings it shows as a plain, typed prop. The locale
  is the synced `settings.language` where there is a session and the browser's `Accept-Language` where there is not
  (`apps/web/src/i18n/`). Plurals stay i18next's on the phone; nothing on the web counts anything yet.
  **Two subpaths are allowed in client components (0.3e-1):** `@saldo/i18n/format` and `@saldo/i18n/translate`,
  which import no catalog, so the transaction form can format a balance while the user types and build its own `t`
  (`makeTranslator`) over the slice of the catalog it receives (`txForm`, `transactions`, `common`, `kinds`). The
  root `@saldo/i18n`, which imports all seven catalogs, stays server-only: a test in `apps/web` refuses a
  `'use client'` file that imports it. This relaxes 0.3d's «no number is formatted in a client component».
- **Tokens as CSS custom properties.** A pure `tokensCss()` in `@saldo/ui` returns `:root` (dark),
  `[data-theme="light"]` and a `prefers-color-scheme: light` block for the `system` preference, with variables
  named `--color-*`, `--radius-*`, `--font-size-*`, `--font-weight-*`, `--motion-*` and `--category-*`. The root
  layout injects it as a `<style>`, so there is no generated file to fall out of step. So that no colour, radius
  or font size is typed by hand, a test in `apps/web` refuses hex and `rgb()` colours and literal `font-size` and
  `border-radius` lengths in any `.module.css`. Strings go through `@saldo/i18n`, formatting through its
  formatters (D16).
- Layout: a sidebar on wide screens, a bottom tab bar on narrow ones. The mobile screens are the **reference for
  behaviour, not a template** for layout. A design pass (HTML variants, as for the phone) comes before any
  screen is built, **one mockup per page** so each can go through its own rounds
  (`docs/superpowers/mockups/2026-09-27-web-<page>-variants.html`): Home with the shell first, because it fixes
  the grid, the sidebar and the tab bar every later page reuses; then Transazioni, Statistiche, Profile, the
  auth pages (`/login`, `/register`, `/auth/mobile`) and Admin. The chosen variant of each is recorded here. Layout
  values the mockups introduce (sidebar width, content max-width, breakpoints) become tokens in `tokens.ts`.
- **Shell and Home (decided 2026-09-27, mockup `2026-09-27-web-home-variants.html`, round 2, variant «C · Aperta»).**
  On wide screens navigation is a **top bar**, not a sidebar: the brand, Home, Transazioni, Statistiche and Conti on
  the leading side; Admin (for the `admin` role), «Nuova transazione» (shortcut `N`) and the profile avatar on the
  trailing side. Below 1024px it is the phone's tab bar and FAB, Profile and Admin reached from the avatar. Home
  opens with a **band** that is not a card: the period header across the full width, «Rimasto da spendere» at 56px,
  Entrate and Uscite beside it, the progress bar with its pace tick under both. Under the band, **two columns** (7/5):
  «In arrivo» and «Ultime transazioni» on the leading side, Budget and Obiettivi (§5.13) on the trailing one.
  Sections are **open, with no card around them**: a title row with one hairline under it, rows separated by space
  and never by lines, 56px between sections and 72px between the columns. Rounds 1 and 2 showed that the phone's
  density (16px padding, 10px between cards, a line under every row) reads as packed at 1280px; the rule kept is
  that the gap between groups is at least twice the gap inside one. On narrow screens Home stays the phone's, cards
  included. New tokens: `topbarHeight` 64, `contentWide` 1120, `pagePaddingWeb` 48, `navItemHeight` 36,
  `fontSize.heroWeb` 56, `sectionGapWeb` 56, `columnGapWeb` 72, and the 1024px breakpoint.
  **Built 2026-09-28 in 0.3d**, band and two columns as decided.
- **Transazioni (decided 2026-09-27, mockup `2026-09-27-web-transactions-variants.html`, variant «2 · Pannello»).**
  The list keeps the open style of Home: period header, search (`/`), the filter chips of §5.12, the filtered total,
  «In arrivo» collapsed, days as title rows with their total and a hairline, rows separated by space, tags shown
  as pills on wide screens. Selecting a row opens its **detail in a panel on the trailing side** (420px) beside the
  list, which stays live and moves with ↑ ↓; the URL carries the selection (`?t={id}`). «Modifica» (`E`) and
  «Nuova transazione» (`N`) open the form **in the same panel**; Esc closes it, ⌘↵ saves. Delete confirms in a
  dialog and offers «Annulla» in a toast for 5s. The amount is typed with the computer's keyboard (D23's keypad is
  the phone's). Recurrences and attachments are shown and not edited (§17.1.9), and the form says so where they
  would be. On narrow screens the phone's patterns stay: detail full screen, the form in a bottom sheet. New
  tokens: `panelWidth` 420, `searchWidth` 320.
  **Built 2026-09-28 in 0.3d**, read side only: the list, the search, the chips, «In arrivo», the days and the
  panel's detail. «Modifica» and «Nuova transazione» arrive with the forms in 0.3e.
  **«Modifica» and «Nuova transazione» built 2026-09-29 in 0.3e-1.** The URL carries the form: `?new` opens «Nuova
  transazione» in the panel, `?t={id}&edit` turns the detail into the form, and after a delete the page is
  `?deleted={id}`, which renders the «Annulla» toast (only for a tombstone of this user; pressing «Annulla» stops
  the toast's timer, so a pending or failed restore stays on screen). «Nuova transazione» in the top bar and the
  FAB are links to `/transactions?new` from any page, and `N` does the same. Below 1024px the form is a **bottom
  sheet** over a scrim (the panel's `data-sheet`), and the **FAB** sits above the tab bar at the trailing edge,
  under the panel and the scrim. An occurrence of a recurrence is edited as that one row; «Ripeti» is read-only and
  says recurrences are managed on the phone.
- **Conti (decided 2026-09-27, mockup `2026-09-27-web-accounts-variants.html`, variant «1 · Lista aperta»).** A band as
  on Home: the page title with «Nuovo conto», Patrimonio complessivo at 56px, Totale spendibile beside it with its
  note. Then two open groups, «Da spendere» and «Risparmi e investimenti», rows separated by space, each account's
  pockets nested under it with their ring and goal line and «Libero» closing the group, as on the phone; archived
  accounts behind one row at the end. Account, credit card and goal details, and the account form, open in the
  trailing panel as in Transazioni (`?a={id}`, `?g={id}`). Tiles (one card per account with its sparkline) were
  considered and not taken: they brought back the cards Home removed.
  **Built 2026-09-28 and 2026-09-29 in 0.3d** — the groups, the pockets and the totals first, then the account,
  credit-card and goal panels. Conti's read side shipped here rather than in 0.3e (decided with the user
  2026-09-28); only «Nuovo conto» and the account form wait for 0.3e.
  **Built in 0.3e-2 (2026-09-30).** The URL carries the form, as in Transazioni. «Nuovo conto» and the account form
  open in the panel (`?new`, `?a={id}&edit`); the archived list is a panel (`?archived`) with «Ripristina» for accounts
  and closed goals. The goal form (the phone's four steps as one panel) was built here in Conti and **moved to Profilo →
  Obiettivi in 0.3e-2b**: Conti's goal panel keeps the money movements and «Chiudi», and its «Modifica» opens
  `/profile/goals?g={id}`. An account with open goals shows «Chiudi prima gli obiettivi in questo conto» instead of «Archivia»;
  archiving asks and has no undo, «Ripristina» is the way back. «Accantona» and «Preleva» are links to the transaction
  form prefilled (`/transactions?new&from=…&to=…&description=…`), not a form of their own. «Chiudi obiettivo» asks
  «Hai usato i soldi?» in a `ConfirmDialog` whose **secondary slot** carries the second choice: «Riporta in {conto}»
  and «Registra la spesa» (the expense form with `closeGoal`), and a close is one write. Below 1024px the panels are
  the bottom sheet.
- **Budget (`/profile/budgets`; decided in 0.3e-2 at `/budgets`, moved to Profilo in 0.3e-2b; no mockup existed).**
  Reached from Home, as on the phone (§5.8), and from Profilo's sub-navigation, not from the top bar or the tab bar:
  the Budget section's «Tutti i budget» link, its rows (`/profile/budgets?b={id}`) and the empty card's «Crea un
  budget» (`/profile/budgets?new`). The page is the open list, a ring per row as Home draws it, with the form (`?new`,
  `?b={id}` to edit, delete asks first and has no undo) in the trailing panel. `/budgets` is kept as a redirect that
  preserves the query string. The detail chart and «Periodi precedenti» stay on the phone (§17.1.9).
  **Built 2026-09-30 in 0.3e-2; moved in 0.3e-2b.**
- **Statistiche (decided 2026-09-27, mockup `2026-09-27-web-stats-variants.html`, variant «3 · Navigatore», lower half
  «Andamento a sinistra» with Quota impegnata under it).** On wide screens Flussi spans the page with **ten
  columns**: six closed periods, the current one and the three forecast ones (D29 kept six because of 320px; the
  desktop has the room). The chart is also the **period picker**: a column, or ← →, selects a period and everything
  below follows. Under it the selected period's name and range, then four key figures: Entrate, Uscite, Netto and
  Proiezione for the running period; Quota impegnata in place of Proiezione for a closed one; for a forecast column
  Entrate, Uscite (with its min–max), Netto and the balance, all «circa». Below, two columns (7/5): Andamento del
  periodo (220px tall) with Quota impegnata under it on the leading side, **sticky** so it stays beside what is read;
  Ripartizione and Tag on the trailing side. A forecast column replaces them with how the forecast is made, the table
  of forecast periods and the recurrences expected that month, so the phone's forecast sheet has no web counterpart.
  The period header's ‹ › stays and moves the same selection. On narrow screens Statistiche stays the phone's.
  `cashflowColumns` takes the half height as a parameter (the phone passes 54, the web 64).
  **Built 2026-09-28 in 0.3d.** One thing the design did not foresee: a forecast column is a period the user can
  navigate *into*, which `@saldo/core`'s `MAX_PERIODS_AHEAD` (0) forbids, because on the phone a period ahead was an
  empty card and the forecast is read in a sheet. Rather than change a constant the phone depends on, the web's
  `periodFromParam`/`periodSteps` take a `reach` — how many periods after the current one this screen may show — and
  return how far ahead the period is (`ahead`). Statistiche passes the number of forecast columns, so the page must
  compute the forecast *before* it reads the period; every other screen passes nothing and behaves as the phone does.
  Four key figures per column kind, no hero: on a forecast column they are Entrate, Uscite, Netto and Saldo, all
  «circa», and the two trailing sections become «Come si calcola», the table of forecast periods and «Ricorrenze
  attese». Every category of Ripartizione is shown, rather than the phone's five plus «Vedi tutte le N»: the room is
  there and a link that only exists to reveal rows is a link the desktop does not need.
- **Profilo (decided 2026-09-27, mockup `2026-09-27-web-profile-variants.html`, variant «5 · Sotto-navigazione +
  pannello»).** Under the profile header (avatar, name, email, role), a sub-navigation on the leading side picks one
  section at a time, each with its URL (`/profile/account`, `/profile/preferences`, `/profile/categories`,
  `/profile/budgets`, `/profile/goals`, `/profile/passkeys`, `/profile/tags`, `/profile/data`), and «Esci» at its end. A section is a list of summary
  rows showing the current value; the row picked is edited **in the trailing panel**, as in Transazioni and Conti
  (`?edit=currency`, `?k={passkeyId}`). Preferences are the synced `settings` and say they apply to the phone too;
  the currency asks for confirmation as on the phone. Passkeys are one row each (name, provider from the AAGUID,
  date added, «in uso ora» for the one that signed this browser in); the panel renames one (the name is Saldo's
  label, the authenticator's own name does not change), shows whether it is synced (`backed_up`) and deletes it
  after a confirmation, **never the last one**: its Elimina is disabled and says why, with a link to add another.
  Lock, permissions, server and CSV import stay the phone's. On narrow screens Profilo stays the phone's.
  **Built 2026-09-28 in 0.3d**: the header, the sub-navigation, «Account» and «Preferenze» as summary rows, and
  «Passkey» wrapped in the same shell (0.3b had shipped it at its own URL). Preferences are read-only rows that say
  they apply to the phone too; the panels that edit them arrive with the forms in 0.3e, as do Categorie, Tag and
  Dati.
  **Built in 0.3e-2b (2026-09-30): Categorie, Budget and Obiettivi.** The sub-navigation gains the three links after
  Preferenze and before Passkey; each section renders its form through `ProfilePanel`, which portals the panel into the
  layout's `#profile-panel` slot. The 2026-10-11 spec replaces this portal design for the pages that use `PanelSwitch`.
  `/profile/categories` follows §5.11: Uscite and Entrate, children indented, «N voci»
  rolled up, up/down buttons to reorder within a sibling group (drag is the phone's), no delete; «Nuova categoria» and
  the edit form (`?new`, `?c={id}`) with name, direction (locked once the category has a parent or children), parent,
  appearance and «Budget mensile»; archiving asks with the usage count and an optional «Sposta le transazioni in»
  target; the archived list (`?archived`) has «Ripristina». `/profile/budgets` is the budget list and form moved from
  `/budgets`. `/profile/goals` lists open goals with a ring and, under «Obiettivi chiusi», closed ones with
  «Ripristina»; `?new` and `?g={id}` open the goal form, whose panel also has «Apri in Conti»: the money movements
  (Accantona, Preleva) and «Chiudi obiettivo» stay in Conti. Tag, Dati and the preference panels remain for 0.3e-3.
  **Built in 0.3e-3 (2026-09-30): the preference panels, Tag and Dati.** The sub-navigation is now Profilo,
  Preferenze, Categorie, Tag, Budget, Obiettivi, Passkey, Dati, «Esci». **Preferenze**: each of the five rows is a link
  that opens its panel at `/profile/preferences?edit=cycle|currency|language|theme|timeZone` (anything else opens
  none). A choice is **saved as it is made**, as on the phone, and the panel stays open on the new selection; after the
  write `router.refresh()` re-renders the root layout, so a language change re-renders the whole shell and a theme
  change flips `<html data-theme>` at once. Only the currency asks first, with the phone's «Cambiare valuta?» and, when
  the two currencies keep a different number of decimals, the before/after figure («€1,842.60 will read as ¥184,260»):
  it reformats, never converts. «Inizio del ciclo» is the 1–28 grid over the preview range; the row shows whatever the
  period kind is, and `periodKind` cannot be changed after onboarding, as on the phone. The time zone list is the
  phone's (saved zone first, this browser's under it when they differ, then every zone, searchable); with no zone
  stored the browser's shows selected and choosing it is what stores it. Deviations from the plan: the option lists are
  radio groups with one tab stop where the arrows move the **focus only** and Space/Enter chooses (a selection that
  followed the arrows would write once per option walked past); a second choice made while a save is still in flight is
  ignored; a refused or thrown save says why and the selection goes back. **Tag** (`/profile/tags`, §5.10): every tag
  with «N transazioni», most used first then by name; `?new` for «Nuovo tag», `?tag={id}` for the panel that renames,
  merges («Unisci a un altro tag», asks with the count, cannot be undone) and deletes («Elimina tag», asks; the
  transactions stay). Names are unique case-insensitively among **live** tags — a merged or deleted tag's name is free
  again. The tag view (totals, split) is not on the web: «Vedi le transazioni» opens `/transactions?tag={id}`.
  **Dati** (`/profile/data`): three plain download links — the JSON backup, the CSV of every transaction and the CSV
  of the current period — to route handlers. A download needs no script. Exception (2026-10-11): with JavaScript off,
  the page shows only the skeleton of `profile/loading.tsx`, so the links do not show. The backup holds the
  attachments' rows, not their bytes.
  **What stays on the phone:** the ZIP backup with the attachments' files, restore, CSV import, «Elimina tutti i
  dati», the tag view, and changing the period kind.
- **Auth pages (decided 2026-09-27, mockup `2026-09-27-web-auth-variants.html`, variant «4 · Un passo alla volta»;
  built 2026-09-28 in 0.3b).** No top bar. `/login` is one open column of 380px in the middle of the page: Rocky waving (the welcome, D26), the
  brand and the instance name, «Accedi a Saldo», the **email field with `autocomplete="username webauthn"`** so the
  browser offers the passkey as soon as it is focused, «Accedi con passkey», a line on the cross-device QR, «Crea
  un account» (absent, with a notice, when registration is closed), the version and host in the footer (§17.1.1).
  `/register` is **in steps**, with the phone onboarding's segments: (1) name and email, (2) the invite code, only
  under `REGISTRATION=invite`, (3) the passkey. An error sits in the step that causes it (email taken in 1, invalid
  invite in 2, cancelled ceremony in 3). `/auth/mobile` is the same pages opened by the app, ending on «Fatto, torna
  all'app». Step 2 needs the code checked **before** the ceremony, so nobody performs a passkey ceremony only to be
  told the code is wrong: 0.3b adds a check endpoint that answers one `invalid_invite` for unknown, spent, revoked
  and expired codes, rate-limited like the auth endpoints; `resolveUser` still checks and `afterVerification` still
  burns, so the endpoint is a convenience and never the gate. As built, each page is a server component that resolves
  its strings and the instance's state and hands a single client component only what it renders, the step being that
  component's own state; `/register?invite=CODE` prefills step 2, which is what a link in an invite message opens.
- **Admin (decided 2026-09-27, mockup `2026-09-27-web-admin-variants.html`, variant «3 · Sotto-nav + pannelli»).**
  The Profilo pattern with no exception: a sub-navigation (Account, Inviti, Istanza, Impostazioni, each with its
  URL under `/admin/`), every section a list of summary rows, every row edited or inspected in the trailing panel.
  An account's panel shows role, state, the invite it came with, last sign-in, passkeys and synced rows, and offers
  promote and revoke; deleting sits in a separate danger zone and asks for the account's email to be typed, since it
  takes every synced row with it. An invite's panel shows who minted it and when it expires, and revokes it; «Nuovo
  invito» mints in the panel (label, TTL of 1, 7, 30 or 90 days) and shows the code **once**, as text, link and QR
  code, with «copy it now». Istanza is read-only rows. Impostazioni has one row per product setting; a setting fixed by
  an environment variable shows «impostato dall'ambiente», and its panel names the variable, explains how to change
  it and shows the choices disabled; the SMTP panel holds the form, with the password as «impostata» and
  «Sostituisci» (write-only) and a test email. A table with tabs was considered and not taken: a household instance
  has a handful of accounts, and one settings pattern across Profilo and Admin matters more.
  **Built in 0.3f-1 (2026-09-30): Account, Inviti and Istanza.** `/admin` redirects to `/admin/accounts`; the head is
  «Admin» over «{instance name} · {N} account», and the sub-navigation (Account, Inviti with the count of *active*
  invites, Istanza) is Profilo's shell (`SubnavLayout`, `SlotPanel`). The 2026-10-11 spec replaces this portal design
  for the pages that use `PanelSwitch`. Every page and every Server Action starts with
  `requireWebAdmin()`: a member gets a 404, nobody signed in goes to `/login`; an admin who has not onboarded still
  gets in, in the default time zone. **Account** (`?u={id}`; an id that names nothing opens nothing): the facts (role,
  state and reason, email verified or not, created and the invite's label, last sign-in, passkeys, synced rows), and
  for another account «Rendi admin» (asks first: it cannot be undone from the panel or the CLI), «Revoca accesso»
  (asks; sessions close at once, data stays), «Ripristina accesso» and, in «Zona pericolosa», «Elimina account», which
  asks for the account's email (its display name when the address is synthetic), disabled until it matches, checked
  again on the server, and removes the attachment bytes with the rows. An admin's own panel has the facts and a note,
  no actions: nobody can lock themselves out, so the last admin is never lost. **Inviti** (`?new` mints, `?i={id}`
  inspects and revokes; `?new` wins): «Nuovo invito» takes a label and 1, 7, 30 or 90 days and shows the code once
  as text, link and QR, held in the panel's state and never in a URL, cookie or storage; the QR is drawn dark on light in
  both themes (`--color-qr-*`). **Istanza**: five read-only rows. What differs from the mockup: no «dal telefono» on
  the last sign-in (nothing reliable says which device), and «Impostazioni» is not in the sub-navigation until 0.3f-2.
- Screens in 0.3: Home, Transazioni (list and form), Statistiche (including the forecast), Conti (accounts,
  pockets and their goals, as the phone's tab; added 2026-09-27, since the web writes accounts), Profile
  (preferences, passkeys, export), Admin.
- **Three view-models moved into `@saldo/core` (0.3d).** `budgetViews`, `goalViews` and `transactionRow` were
  `apps/mobile` modules that were already pure and already depended on core alone. Leaving them there would have
  meant writing each a second time in `apps/web`, which is what §17.1.2 forbids — so they moved, and both apps now
  render a budget's ring, a goal's progress and a transaction row from one implementation. `transactionRow` lost its
  `IconName` and `SignDisplay` imports on the way (core depends on no other workspace package) and returns
  `icon: string` and its own `AmountSign` union, which each app narrows at its edge. The phone's existing tests came
  with them unchanged, which is what shows the move changed no behaviour. This is the rule §17.1.2 states, applied:
  when the web needs a figure the phone already shows, the calculation moves to core rather than being written twice.

- **The period and the filters live in the URL (0.3d).** The period is `?p=<a date inside the range>` — written as
  the range's start, read as any date the range contains — on every screen that has a period header, and the filters
  of §5.12 are query parameters of their own (`direction`, `account`, `category`, `tag`, `q`, and `?t=`/`?a=`/`?g=`
  for a panel's selection). An **offset** was considered and not taken: «three periods before now» changes meaning at
  midnight and cannot be shared or bookmarked, while a date is the same period whenever it is opened, and
  `describePeriod` turns it straight back into a `PeriodView`. The consequence that matters for the markup is that
  every chip, every ‹ › and every row that opens a panel is an `<a href>`: they can be opened in a new tab, and the
  back button does what the user means. Exception (2026-10-11): the app needs JavaScript. Sign-in uses a passkey only,
  and with JavaScript off a page under a `loading.tsx` shows only its skeleton. A URL that could not be reached by
  clicking falls back to the period containing «today» rather than rendering — a hand-typed `?p=` must not be able to
  show a page the interface does not offer.

- **Chart geometry is shared.** The calculations inside the phone's charts (axis scale, ticks, bar heights, the
  forecast band, arcs) move into renderer-agnostic pure functions that return coordinates. The phone draws them
  with `react-native-svg`, the web with DOM `<svg>`, so the two charts are the same chart. They live in
  `packages/ui/src/charts/`, exported from `@saldo/ui` (D4 allows it: they return numbers, they render nothing):
  the cashflow chart (bar heights, the forecast band, the hidden-mode stub, the forecast divider), the trend and
  sparkline polylines, the spend-history columns, the split shares and the target ring (`ringGeometry`, moved
  from `apps/mobile`). The design constants move with them. The phone's chart components are refactored onto
  them with their existing tests unchanged, which is what shows the refactor draws the same thing; the web's
  `<svg>` components arrive with the screens (0.3d).
- **PWA:** a web manifest, icons, and a minimal service worker that serves an offline page. No offline data: the
  web app is online-only by decision (roadmap 0.3).
  *Built in 0.3g:* the manifest (`/manifest.webmanifest`) carries the instance name and `display: standalone`;
  icons are the phone's mascot (`public/icons/`, `app/icon.png`, `app/apple-icon.png`, plus a maskable one at 80%
  on the icon's own background). `/sw.js` (generated, `Cache-Control: no-cache`, scope `/`) intercepts navigations
  only: network first, on failure the cached `/offline`, a self-contained page in the `Accept-Language` locale.
  API calls, Server Actions, assets and signed-in pages are never cached. Registered in production builds only.

#### 17.1.8 Admin panel (`/admin`)

- Reachable by the `admin` role only (`requireAdmin`, §9.5). It puts a UI on functions that already exist behind
  `scripts/user.ts` and `scripts/invite.ts`, which stay.
- **Accounts:** list with email and role, revoke and restore, promote, delete. `listAccounts` carries the email from
  0.3b (D32), so `scripts/user.ts list` shows it too — synthetic or real.
- **Invites:** mint (the code is shown once, as text, link and QR code), list, revoke.
- **Instance:** version, `apiVersion`, `SYNC_SCHEMA_VERSION`, storage driver. (Rows skipped by the projection: deferred, §17.1.2.)
- **Built in 0.3f-1 (2026-09-30):** accounts, invites and instance are in the panel (§17.1.7); the CLI stays, for the
  first invite and for the day no admin can sign in. Server settings and SMTP are 0.3f-2; verification and recovery are 0.3f-3 (§17.1.4).
- **Server settings** (D33): a `server_settings` table (`key`, `value jsonb`, `updated_at`, `updated_by`).
  - Infrastructure stays in the environment and needs a restart: `DATABASE_URL`, `PUBLIC_URL`, `WEBAUTHN_*`,
    secrets, attachment storage.
  - Product settings live in the table and change from `/admin`: registration mode, instance name, SMTP (host,
    port, user, password, sender), and from 0.5 the AI provider, model and key (**one key per instance**, D36).
  - An environment variable that sets the same thing **wins and locks it**: the panel shows «set by the
    environment» and does not offer to change it. `REGISTRATION` keeps working this way.
  - Secret values (SMTP password, AI key) are encrypted at rest with AES-256-GCM under a new required variable,
    `SETTINGS_ENCRYPTION_KEY`, and are **write-only** in the panel: it shows «set» and «replace», never the value.

- **As built (0.3f-2, 2026-09-30):**
  - `server_settings(key text pk, value jsonb, updated_at, updated_by → user on delete set null)` with three keys:
    `registration`, `instanceName`, `smtp` (`{ host, port, user, password, from }`). One resolver
    (`src/server/settings/resolve.ts`) merges environment → row → default and says where each value came from; a
    row that no longer parses reads as not set and is logged by key. `registrationMode` does not read the table
    when `REGISTRATION` is set, and the gate calls it at ceremony time, so a saved mode applies to the next
    registration without a restart.
  - `src/server/settings/secret.ts`: `v1:{iv}:{tag}:{ciphertext}` (base64 parts), a random 12-byte IV, the slot name
    (`smtp.password`) as additional authenticated data; a wrong key, slot, tampering or a malformed value decrypts
    to `null`, never throws. Only `smtpForSending` opens the password; pages and actions get `SmtpView`
    (`passwordSet`, `passwordReadable`). The stored password may be kept only while host and user are unchanged
    (`passwordRequired` otherwise). Port 465 is implicit TLS, any other port requires STARTTLS except to
    `localhost`, `127.0.0.1` and `::1`.
  - Writes return `{ ok } | { error: 'locked' | 'invalid' | 'passwordRequired' }`; `locked` is decided on the
    server from the resolver. Every Server Action in `/admin/settings` starts with `requireWebAdmin()`.
  - `sendMail(db, message)` builds a nodemailer transport per message from the resolved configuration (10 s
    connection and greeting timeouts), plain text only; `detail` goes to the admin's test-email panel and never to
    a log. The test email goes to the signed-in admin's own address, in their language.
  - `/admin/settings?edit=name|registration|smtp`; a locked setting shows «Impostata dall'ambiente» with the
    variable (its value for `REGISTRATION` and `INSTANCE_NAME`, never `SMTP_PASSWORD`). Registration is saved with
    «Salva», not on choice. `OptionList` moved to `src/ui/`. The panels close on save, except SMTP, which stays
    open so the test email can be sent. Verification and recovery are 0.3f-3.

#### 17.1.9 Not in 0.3

Recurrence editing, attachment upload, the period recap sheet, server-side materialisation of recurrences,
desktop-only features (bulk edit, CSV import with preview, printing: an improvement after release), offline
data, end-to-end browser tests.

#### 17.1.10 Done when

A user registers on the web (email, passkey, and an invite where required), or signs in with the phone's passkey; on
an instance with SMTP, verifies the address and gets back in without the passkey through a link to that address;
sees Home, Transazioni and Statistiche matching the phone to the cent; adds and edits a transaction that reaches
the phone on its next sync; installs the app to the home screen. An admin manages accounts, invites and server
settings from `/admin`. The projection is the only way server code reads rows.

### 17.2 AI receipt analysis (BYOK)

- Settings → "Intelligenza artificiale": provider (Anthropic / OpenAI-compatible base URL), API key stored **only** in
  `expo-secure-store` (never synced, never sent to the Saldo server), model id.
- `@saldo/core/ai` defines `ReceiptAnalyzer` →
  `analyze({ imageBase64, mimeType, locale, currency, categories }) → { amountMinor?, date?, merchant?, categoryId?, confidence }`.
- Flow: "Allega foto" → "Analizza scontrino" → prefill the transaction sheet; the user always confirms.
- Default model suggestion for Anthropic provider: `claude-sonnet-5` (vision), prompt caching on the static system
  prompt + category list.

### 17.3 AI spending analysis (BYOK)

- Sends **aggregates only** (per-cycle category totals, budgets, trends from `@saldo/core`), never raw descriptions,
  unless the user opts in.
- `@saldo/core/ai` `InsightsProvider` interface; results cached locally per cycle.

### 17.4 MCP server (milestone 0.4, decided 2026-10-03)

The server exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint so an assistant the user
already runs — Claude Code, Claude's connectors, Cursor, any MCP client — reads and writes their data on their own
instance. The mirror image of 0.5: there the server holds a key and calls a model; here the user's model calls the
server, and no key ever touches Saldo. ROADMAP «0.4» holds the history of the idea; this section is the design.

#### 17.4.1 One authorization server, OAuth 2.1 only (D39)

- **Saldo is the authorization server for its own MCP endpoint.** The `@better-auth/oauth-provider` plugin is
  mounted on the existing Better Auth instance (§9, §17.1.4), so the OAuth endpoints live under
  `/api/auth/oauth2/*` (`register`, `authorize`, `token`, `revoke`, `introspect`) and the two discovery documents
  MCP clients require are served at the root: RFC 8414 `/.well-known/oauth-authorization-server` and RFC 9728
  `/.well-known/oauth-protected-resource`. The issuer is `{PUBLIC_URL}/api/auth` (the plugin's, checked against
  `@better-auth/oauth-provider` 1.7.7 while planning 0.4a-2; it needs `better-auth` ^1.7.7).
- **No personal access tokens.** The ROADMAP sketched a token pasted into the client; it is dropped. One
  credential surface is enough to describe and to defend, and OAuth is the only one the connectors of claude.ai
  and the mobile Claude apps accept. A CLI client that cannot open a browser uses `mcp-remote` or its own
  device-style flow; the device authorization grant is **not** offered until a client asks for it.
- **Clients register themselves** (RFC 7591 dynamic client registration, no session required, as MCP expects).
  Every client is public: PKCE S256 is mandatory, redirect URIs are `https://…` or loopback
  (`http://127.0.0.1`, `http://localhost`, any port), exact match. Registration is rate-limited per IP (one per
  minute) and a registration does not grant anything by itself — a token exists only after a user consents.
- **Tokens are opaque, stored hashed, checked on every call.** `disableJwtPlugin: true`: the plugin issues no
  JWT, so there is nothing a revocation has to wait for. Access tokens live **1 hour**; refresh tokens are rotated
  on every use (`refreshTokenReuseInterval` 30 s for clients that retry) and each new one lives **180 days**, so an
  authorization that is not used for six months lapses on its own — the same bound the phone's session has (§18).
  Revoking in Profile deletes the consent and every token of that user–client pair; the client's next request is
  a 401, and it has to be authorized again.
- **The resource is `{PUBLIC_URL}/mcp`.** Clients send it as the `resource` parameter (RFC 8707) on the
  authorization and token requests; the endpoint accepts only tokens bound to it. An unauthenticated request is
  answered `401` with `WWW-Authenticate: Bearer resource_metadata="{PUBLIC_URL}/.well-known/oauth-protected-resource"`;
  a token in the query string is refused, as OAuth 2.1 requires.
- **Two scopes: `read` and `write` (D40).** A client asks for one or both; the consent page shows them as two
  lines and the user can refuse `write`. Tools are filtered by scope when the server is built for a request
  (§17.4.2), so a `read` token never even lists a write tool; a call that slips through anyway is refused with the
  JSON-RPC error `insufficient_scope`. The plugin issues a refresh token only when `offline_access` is in the
  scope, so Saldo adds it as a third, hidden scope that the consent page never shows. Nothing else is granted: no OpenID Connect, no id token, no `userinfo`
  claims beyond what the plugin needs, no client credentials, no DPoP, no CIMD. Each is added the day a client needs it.
- **Consent at `/oauth/consent`**, on the auth layout of §17.1.7. The plugin sends the browser there with a signed
  query (`verifyOAuthQueryParams`); a visitor who is not signed in goes through `/login` first and comes back. The
  page names the client as it registered itself, shows the redirect host in full, explains the two scopes in one
  line each, and offers «Autorizza» / «Nega». A refusal redirects with `access_denied`. Consent is remembered: the
  same client asking for the same or fewer scopes is not asked again.
- **An admin can switch it off.** `mcp.enabled` in `server_settings` (default on), shown on its own admin page
  `/admin/mcp` (§17.4.3); `MCP_ENABLED=true|false` in the environment wins and locks the switch, like the other
  settings (D33). Off: `/mcp` and both `.well-known` documents answer 404, `/oauth/consent` refuses, and
  `/profile/connectors` says so. Tokens already issued stop working at `/mcp` while it is off and work again when it
  is on; refreshing and revoking a token keep working while it is off, so a client can still clean up.

#### 17.4.2 The endpoint and the tools

- **Transport.** `POST {PUBLIC_URL}/mcp`, Streamable HTTP in **stateless** mode with JSON responses (no SSE
  stream, no session id): every request carries its token, is authenticated, served and forgotten. `GET` and
  `DELETE` answer 405. The server is built per request from the `@modelcontextprotocol/server` SDK, registering
  the tools of the catalogue that the token's scopes allow. Body limit 1 MB; rate limit 120 requests per minute
  per token, per process like the others (§18).
- **The catalogue lives in `@saldo/core`**, folder `assistant/`: for each tool its name, its description (in
  English — it speaks to the model, not to the user), the Zod schemas of input and output, the MCP annotations
  (`readOnlyHint`, `destructiveHint`, `idempotentHint`) and, for the read tools, a pure
  `run(data: UserData, ctx: { today, timeZone }, input) → output` with unit tests. This is the one description of
  «what a model is told about the user» that D38 asked for: 0.5 calls the same functions in-process. Next to it,
  `assistantInstructions`, the text the server sends in `initialize.instructions`: what a period is and how the
  cycle day moves it, that amounts come as minor units with a decimal rendering, how categories nest, which
  currency the user keeps, and that «today» is the user's, in the user's time zone (D37).
- **The route is thin**: authenticate → `loadUserData` and `todayFor` (§17.1.2, §17.1.5) → build the server →
  answer. A read tool is `run(data, ctx, input)`. A write tool maps its input onto the server's existing write
  functions (`apps/web/src/server/write/*`, §17.1.3) — the same code the web's forms call, with the rules in core,
  `writeInTransaction` and the `basis` check — so an assistant cannot write what a form could not. It cannot
  overwrite an edit the phone made meanwhile either, but `basis` alone does not give that (it covers only the
  instant between the function's own read and its lock): the read tools hand out each row's `updatedAt`, an
  update sends back the one it read as `expectedUpdatedAt`, and the write function refuses inside its
  transaction when the row has moved on. Updates are partial — the id, `expectedUpdatedAt`, the changed fields
  (0.4b). The web's forms adopt the same check in 0.4b (decided 2026-10-03): today a form saved over a phone edit
  made after the page loaded overwrites it. A refused write (rule, conflict, unknown id) comes back as a tool
  error with a readable message, never as an exception or a 500.
- **Results.** Every tool returns `structuredContent` and the same JSON as `content[0].text`. An amount is
  `{ "minor": 12345, "currency": "EUR", "amount": "123.45" }` — the model reads `amount`, which
  `formatMinorUnits` renders from the integer; arithmetic goes back to `minor`. Dates are `YYYY-MM-DD`. Entities
  carry their real ids so a write can name them, and the names the user typed for accounts, categories and tags,
  untranslated. No aggregate is computed here: a tool returns what a page of the app already shows, through the
  same core functions (`summarizePeriod`, `spendingByCategory`, `budgetViews`, `accountBalances`,
  `forecastPeriods`, …), and a parity test checks that a tool and the page it mirrors say the same numbers.
- **Periods.** A tool that takes a period accepts `period`: `"current"`, `"previous"`, or a `YYYY-MM-DD` date
  inside the period wanted — the web's `?p=` — or an explicit `from`/`to` pair; resolution is `period.ts`'s.
- **Read tools (scope `read`):** `get_preferences` (today, time zone, currency, period kind and the current period's
  bounds, language) · `list_accounts` (balances, pockets; archived on request) · `list_categories` ·
  `list_tags` · `list_transactions` (filters: period, kind, account, category, tag, text; `limit` ≤ 200 and
  `offset`) · `get_period_summary` (income, expenses, balance, «Quota impegnata», the previous period beside it)
  · `spending_by_category` (totals per category, rolled up to parents) · `list_budgets` (with progress) ·
  `list_goals` · `list_upcoming` (next occurrences of the recurrences and the one-off transactions dated after today — decided
  2026-10-03) · `get_forecast` (the three periods of 0.2).
- **Write tools (scope `write`)**, the web's perimeter and no more: `save_transaction` (create, or update by id) ·
  `delete_transaction` · `save_account` · `archive_account` (and restore) · `save_category` · `archive_category`
  (and restore, with the move of §6) · `save_tag` · `merge_tags` · `delete_tag` · `save_budget` · `delete_budget`
  · `save_goal` · `move_goal_money` (set aside / withdraw) · `close_goal`. Recurrences and attachments stay out,
  as on the web (§17.1.3). The assistant's client is what asks the person to confirm a write; the server does not
  add a second confirmation.
- **Not offered:** resources, prompts, sampling, elicitation, notifications.

**As built (0.4a-2, 2026-10-03):**

- **The plugin, configured.** `@better-auth/oauth-provider` 1.7.7 on Better Auth 1.7.7: `disableJwtPlugin`, access 1 h,
  refresh 180 days rotated on use with a 30 s reuse interval, `grantTypes` authorization code and refresh, open
  registration (one per minute per IP through the plugin's rule on Better Auth's limiter), `resources:
  ['{PUBLIC_URL}/mcp']`, exact redirect matching, no client or resource CRUD. A Saldo plugin checks a registration
  first: public clients only (`token_endpoint_auth_method: "none"`, set when absent), redirect URIs `https://` or
  `http://localhost` / `http://127.0.0.1`, `application_type: "native"` when a loopback URI is present (the plugin
  refuses loopback for `web`, which is what Claude Code sends). The catch-all route serves only `register`,
  `authorize`, `token`, `revoke` and `introspect` under `/api/auth/oauth2/`; while MCP is off, `register`,
  `authorize` and `/api/auth/.well-known/*` answer 404 too (a refresh keeps working: `/mcp` is 404 anyway).
- **`offline_access`, a third scope nobody sees.** The plugin issues a refresh token only when the scope contains
  `offline_access`. The protected-resource document lists `read write offline_access`, and the consent grants
  `offline_access` with `read` whenever it was asked for; the consent page shows only `read` and `write`.
- **Discovery** is four route handlers (no rewrite): `/.well-known/oauth-protected-resource` (+ `/mcp`) and
  `/.well-known/oauth-authorization-server` (+ `/api/auth`, the RFC 8414 form for the issuer's path).
- **`/mcp` verifies tokens itself**: SHA-256 of the bearer (the function is Saldo's, passed to the plugin as
  `storeTokens.hash`) looked up in `oauth_access_token`, then revocation, expiry, `resources ∋ {PUBLIC_URL}/mcp`,
  client not disabled, account not revoked, and a consent for the user–client pair still on file (the plugin's code
  and refresh grants never check it, so a code exchanged after «Revoca accesso» would otherwise mint a token
  `/profile/connectors` cannot show or revoke). The plugin's own validation also requires the browser session the
  consent was given in to be alive, and on sign-out the plugin revokes every token tied to that session; Saldo's
  check ignores the session and a small plugin detaches each token from it as `/oauth2/token` issues it, so
  signing out of the web does not stop an MCP client.
- **Consent** is Saldo's: `submitConsent` verifies the signed query, writes the `oauth_consent` row and sends the
  browser back to `/api/auth/oauth2/authorize`, which issues the code because the consent now covers the request.
  `/login` reads the same signed query and resumes there after the passkey. A client is «registrata adesso» when it
  registered less than 10 minutes ago and nobody has consented to it.
- **`insufficient_scope`** is HTTP 403 with `WWW-Authenticate: Bearer error="insufficient_scope", scope="read write",
  resource_metadata=…` and a JSON-RPC error `{ code: -32600, message: "insufficient_scope" }`.
- **Transport:** MCP SDK v2 (`@modelcontextprotocol/server` 2.3.0, spec 2026-07-28). 2025-era clients are served by a
  stateless transport with JSON responses; 2026-07-28 clients by `createMcpHandler` in `json` mode; one `McpServer`
  per request, `tools.listChanged` off.
- **`mcp_usage`** counts in memory per process and writes the first request, then at most once a minute per pair;
  up to a minute of counts is lost if the process stops (best effort, §17.4.3).
- **Dependencies.** `apps/web` lists `@better-auth/utils` 0.4.2 directly: without it the provider resolves its
  `@better-auth/core` peer to a second copy (pulled in through `better-call`'s `@better-auth/utils` 0.5.0) whose
  plugin types do not match Better Auth's.

**As built (0.4b, 2026-10-04):**

- **The specs and their input resolvers live in `@saldo/core` `assistant/write/`**, one file per domain; the
  handlers in `apps/web/src/server/mcp/write/` read, call a resolver, call the web's write function and answer.
  The refusal texts a model reads (`refusalMessage`) live in core beside the descriptions, and name the read tool
  to call next.
- **The version check.** `basis` only covers the gap between a write function's own read and its row lock. The
  gap an assistant opens — between its `list_…` and its write, seconds to minutes — is covered by the
  `updatedAt` the read tools return: every tool that changes or removes a row takes it back (`sourceUpdatedAt`
  for `merge_tags`), and the write functions check it as `expectedUpdatedAt` inside their transaction
  (`movedSince`); a row that moved answers «changed after you read it» and nothing is written. The web's edit
  forms and confirms send the `updatedAt` their page loaded the same way, so a form saved over a phone's later
  edit answers `conflict` («reload the page») instead of overwriting it; «Nuovo …», restore, «Annulla», reorder
  and preferences send none.
- **Partial updates.** An update names `id`, `updatedAt` and only the fields to change; the resolver starts from
  the stored row through the forms' own `…FormFrom` functions. `saveAccount` accepts `buffer: null` to keep the
  stored opening balance, so a rename never recomputes it from a balance read earlier; the web's account form
  sends `null` too when its balance field still holds what the page loaded (`balanceToSend`), because a phone
  transaction pushed meanwhile does not change the account's own `updatedAt` and would otherwise be cancelled.
- **Amounts are integers in minor units up to 99,999,999** (the keypad's eight digits), turned into the keypad
  buffer so the server's checks still run. `move_goal_money` is the «Metti da parte» / «Preleva» transfer
  through `saveTransaction`; `save_tag` creates through `createTag` (an existing name answers that tag). Icons,
  colours, notes, «Registra la spesa», restoring a closed goal and reordering categories are not offered.

**Links to the web app (2026-10-05):** `get_preferences` answers `webApp` — the web app's url (`PUBLIC_URL`) and,
per kind of row (transaction, account, goal, budget, category, tag), a link with `{id}` to replace by the row's
id: the page and parameter that open it (`/transactions?t=`, `/accounts?a=` / `?g=`, `/profile/budgets?b=`,
`/profile/categories?c=`, `/profile/tags?tag=`). The routes are the web's (`webAppLinks` in
`apps/web/src/server/mcp/urls.ts`); core only passes them on through `ToolContext.webApp`, and the
instructions name the url and tell the model to give the link after a write. `webApp` is `null` when the
caller does not know the web app.

#### 17.4.3 «Connettori» in Profile, consent, and what the admin sees

- **The look was decided before it was built (0.4-ui, 2026-10-03).** As 0.3c did for every web page, the three
  screens were first drawn as variants in one HTML harness, `docs/superpowers/mockups/2026-10-03-mcp-apps-variants.html`,
  on the web tokens and the shells of §17.1.7, with their empty, filled, «switched off» and error states. The user
  picked; the harness's «★ Scelta» variant (its default) is the reference 0.4a builds, and the bullets below
  describe it.
- **The word is «MCP».** Every user-visible string of this milestone says «MCP» or «client MCP» — the card, the
  empty state, the «switched off» notices, the consent page, the admin page, its sub-navigation entry —
  never «assistente» or «assistenti». The in-app assistant is 0.5's; this milestone is a protocol endpoint the
  user points their own client at, and the copy names it so. The same goes for the docs' headings (§17.4.4).
- **The Profile section is «Connettori»** (decided 2026-10-03, replacing the mockup's «App collegate»): the word
  Claude uses for the same remote MCP servers, so a user moving between the two apps meets one name. What the
  section lists are «connettori» too — counts, empty state, notes, the admin's numbers. The consent page keeps
  «app» for the external application asking to connect, because there it names a program, not a list entry.
- **`/profile/connectors`** («Connettori»), a section of Profilo's sub-navigation after Passkey (icon `plug`). Two
  sections, the top one from variant C and the rows from variant B:
  - **«Collega»**: one line of explanation (give this address to your MCP client; no key to copy; the client
    brings you back here, you sign in with your passkey and choose what it may do), the endpoint
    `{PUBLIC_URL}/mcp` with «Copia», and tabs per client — **Claude Code** (the exact
    `claude mcp add --transport http saldo {PUBLIC_URL}/mcp` line, and that the first call opens the browser),
    **Claude** (Settings › Connectors › Add custom connector, paste the address), **Altro client** (any MCP client
    with HTTP and OAuth discovers the rest from `/.well-known/oauth-protected-resource`; `npx mcp-remote` for a
    terminal without a browser).
  - **«Autorizzati»** with a count: one row per consent — the client's tile, its name, the granted scopes as
    chips (only those granted: «Lettura», «Scrittura»), when it was authorized, when it was last used, and a
    chevron. A row opens the trailing panel of §17.1.7, the passkeys' pattern: the facts (scopes, the redirect
    host it returns to, authorized on, last used, calls since), one line on what a client sees and may change,
    and «Revoca accesso» at the bottom with an inline confirmation («Revocare {client}? Smetterà di funzionare
    alla prossima chiamata»). On the phone-width layout the panel is a pushed screen titled with the client's
    name. Under the rows, the 180-day and next-call notes.
  - **No consent**: «Collega» as usual and, under «Autorizzati», the empty state («Nessun connettore collegato»).
    **MCP switched off**: «Collega» is replaced by a warning («MCP è disattivato su questa istanza»); to an
    admin it says they switched it off and links to `/admin/mcp`. The rows stay, so revoking still works.
- **`/oauth/consent`**, variant C («Carta del client»), on the auth layout: the brand, the title «Un'app chiede di
  collegarsi», then the client's card (initial, name as it registered itself, «torna a {redirect host}», and
  «registrata adesso» or «già autorizzata il …»). A client registered moments ago — not seen before — gets a note
  under the card: the name is chosen by the app itself, trust it only if you started the request a moment ago.
  Then «Cosa può fare a tuo nome:» and the two scopes as checkbox rows — «Leggere i tuoi dati» always on and marked
  «richiesto», «Aggiungere e modificare» only when the client asked for `write`, untickable. Then who is signed in
  with «Non sei tu?», «Autorizza» (it reads «Autorizza solo la lettura» when `write` was unticked) and «Nega»,
  and the revocation note («… da Profilo › Connettori»). States drawn: both scopes, read only, a client asking for `read` alone, refused
  («Accesso negato», back to Saldo) and switched off («MCP è disattivato»).
- **Admin: its own page `/admin/mcp`**, variant C — an entry «MCP» (icon `plug`) in the admin sub-navigation
  after Impostazioni; `/admin/settings` gets no MCP row. The page holds:
  - the switch «Permetti agli utenti di collegare client MCP» with one paragraph on what on and off mean (each user
    authorizes their own clients with their passkey; off: the endpoint answers 404 and authorized connectors stop
    until it is back on). Switching **off** asks first, inline, naming what stops («3 utenti hanno 5 connettori autorizzati:
    smetteranno di rispondere alla prossima chiamata»), «Annulla» / «Spegni»; switching on needs no confirmation.
    With `MCP_ENABLED` set, a lock note names the variable and the switch is disabled;
  - three numbers: **users with a connector** (out of all accounts), **connectors authorized**, **connectors used
    in the last 7 days** — aggregates only, no client names, no user's detail. (The mockup's first draft had «calls
    today»; `mcp_usage` keeps a running count per pair, not per day, so it became the 7-day count, which
    `last_used_at` answers.) Istanza (`/admin`) shows nothing about MCP: the numbers live here;
  - «Cosa dare a un client»: the endpoint with «Copia», and a line naming the two `.well-known` documents served
    on this host and that `PUBLIC_URL` has to be `https://`.
- **«Ultimo uso»** is a table of ours, `mcp_usage (user_id, client_id, last_used_at, calls)`, written on a request
  to `/mcp` at most once a minute per pair (the calls of that minute added in one write). It feeds the rows, the
  panel and the admin's 7-day count. Best effort: up to a minute of counts can be lost when the process restarts
  (decided 2026-10-03).
- Strings under `web.connectors.*`, `web.consent.*` and `admin.mcp.*`, in all seven locales (the parity test).
- **Built in 0.4a-3.** The Profile section is **«Connettori»** at `/profile/connectors` (renamed from «App
  collegate» by the user on 2026-10-03: it is Claude's word for a remote MCP server); what that page and `/admin/mcp`
  count is a *connettore*, while the consent page still says «app» for the application asking. Readings of the
  mockup: «Connettori» sits after Passkey (the spec; the mockup had it last); the client's tile is its initial
  everywhere (a self-registered name says nothing reliable about the kind of client); on the phone-width layout the
  selected connector is the trailing panel full screen, headed by the tile and the client's name; «Ultimo uso» reads
  «oggi», «ieri» or a date in the user's zone. The switched-off notice has a third body for an admin when
  `MCP_ENABLED=false` locks it, naming the variable. A visitor who reaches `/oauth/consent` signed out goes to
  `/login` with the same signed query, which resumes the request (0.4a-2). «Nega» shows «Accesso negato» while the
  browser goes to the client's redirect with `access_denied`.

#### 17.4.4 Security, documentation, steps

- §18 gains a paragraph, and `SECURITY.md` a section «MCP e connettori»: what a token is and is not,
  the audience, the scopes, the immediate revocation, the 180 days, that no token is ever logged or accepted in a
  URL, that a write goes through the same path as the web's, and that this server never calls a model itself.
- `docs/self-hosting.md` gains «Collegare un client MCP»: the endpoint, `MCP_ENABLED`, and that `PUBLIC_URL` has
  to be `https://` — MCP clients refuse to authorize against plain `http` anywhere but on the same machine.
- **Tests.** The catalogue by TDD on fixtures, with the parity tests against the pages' view functions; the route
  on PGlite: 401 with the challenge, 403 on scope, a tool call that answers, a revocation that turns the next call
  into a 401, the switch; the consent page; `resolveSettings` with `MCP_ENABLED`; the i18n parity.
- **Three steps, four plans** (`docs/superpowers/plans/2026-10-03-0.4*.md`): **0.4-ui** — the mockup harness of
  §17.4.3, iterated with the user until a variant per screen was picked and written into the spec (**done
  2026-10-03**, no branch); **0.4a**, on `phase/0.4a-mcp-read`, in three plans — **0.4a-1** the tool catalogue in
  core (read tools), **0.4a-2** the OAuth provider, the discovery documents, the switch, `mcp_usage` and `/mcp`,
  **0.4a-3** `/profile/connectors`, `/oauth/consent`, `/admin/mcp`, the strings and the docs; 0.4a-1 and 0.4a-2
  run side by side, 0.4a-3 after both; **0.4b**, on `phase/0.4b-mcp-write` from `main` once 0.4a is merged — the
  write tools and the `updatedAt` version check.

#### 17.4.5 Done when

A user connects an MCP client to their instance through the browser consent alone, asks about the current period,
and the answer matches Statistiche to the cent; with `write` granted, a transaction the assistant creates reaches
the phone on its next sync; revoking the app in Profile turns the assistant's next call into a 401; an admin
switches the whole thing off from `/admin/mcp`.


---

## 18. Security & privacy checklist

- No telemetry, analytics or third-party network calls from the app except the server the user typed and signed in
  to (§6.29 step 0, §6.30) — `GET /api/health` on an address typed but not yet signed in to is the only request made
  before that — and, in the future, the user-configured AI provider.
- **The server is whoever the user points the app at.** `/api/health` is a usability check, not authentication:
  anything can answer like Saldo. What is guaranteed is that the app talks to the host that was typed (HTTPS, plain
  `http` only to this machine) and that a passkey never leaves the origin it was made for. What cannot be guaranteed
  is that the host is the right one, so the host is shown on the server row before signing in and named again in the
  «Dati su questo telefono» question, the moment local rows would be pushed to it.
- One opaque session token in the keychain/keystore (Expo SecureStore), not an access/refresh pair: phase 06b replaced
  the original OAuth-style design with Better Auth passkeys, and there is no refresh token to rotate or detect reuse
  of. The session is sliding — it renews on use, at most once every 14 days — and lapses after 180 days with no
  contact with the server at all. The control that actually matters for a lost or stolen phone is server-side:
  `revokeUser` deletes the session row outright, which is refused on that device's very next request, at any time,
  independent of the expiry above.
- Server: parameterised queries only (Drizzle), Zod validation on every body, per-user scoping on every query
  (`user_id = requireUser().id`), body size limits (sync 5 MB, attachments 10 MB), auth rate limiting, secure headers
  (`X-Content-Type-Options`, `Referrer-Policy`, CSP on auth pages), and no user enumeration in auth errors.
- `redirect_uri` allow-listed by scheme. There is no OAuth code grant, so no PKCE: the handoff is a Better Auth
  one-time token, minted in the browser once the passkey ceremony succeeds, stored hashed, single-use, with a 60s
  TTL, and bound to the attempt that requested it by a client-generated `state` the app verifies before it will
  exchange the token.
- **Secrets at rest.** The one secret the server stores on an admin's behalf (the SMTP password; from 0.5 the AI
  key) is encrypted with AES-256-GCM under `SETTINGS_ENCRYPTION_KEY`, with the slot name as authenticated data,
  so a database backup alone does not leak it. It is write-only: no page, action response, log line or error
  carries it or its envelope, and the stored one is kept only for the host and user it was saved with. Losing the
  key loses that secret and nothing else. A server-side-rendered Server Action's arguments are logged by
  `next dev` (development only); production builds do not.
- **Recovery by email makes the mailbox as strong as the passkey**, on an instance whose admin configured SMTP and
  only there. Bounded: only a **verified** address is ever sent a link, never a revoked account, never a synthetic
  address; the link is single-use, stored hashed, lives 15 minutes and spends only when a person presses the
  button on `/recover/confirm`; callbacks are fixed paths on this site; the response does not reveal whether an
  address has an account or is verified (the send is not awaited); each mailbox gets at most one message per kind per
  minute and five per hour, on top of the per-caller rate limit. The throttle and the limiter are **per process**:
  more than one replica multiplies them. `POST /sign-in/magic-link` writes a `verification` row for any address it
  is given, bounded by the plugin's rate limit and the 15-minute expiry. An admin who does not want recovery leaves
  SMTP unconfigured.
- **Assistants and connected apps (0.4, §17.4).** An MCP client holds an OAuth 2.1 token the user granted on
  `/oauth/consent` after signing in with a passkey; nothing is pasted, nothing is shared out of band. Tokens are
  opaque and stored hashed, bound to `{PUBLIC_URL}/mcp` as audience, scoped `read` and/or `write`, accepted only in
  the `Authorization` header, never logged. The access token lives 1 hour, the refresh token is rotated on use and
  lapses after 180 days unused; revoking the app in Profile deletes the pair's tokens and the next call is a 401.
  A write through a tool is the web's write (§17.1.3): same rules, same `basis` check, same per-user scoping. The
  server never calls a model on its own in this milestone; an admin can switch the endpoint off (`MCP_ENABLED`).
- CSV import treats every cell as text. The CSV export prefixes cells starting with `= + - @` with `'` (formula
  injection) **except** the numeric `amount` column.
- App lock hides content in the app switcher (`expo-screen-capture` / privacy overlay on `AppState` inactive).

---

## 19. Assumptions & open questions (resolve during implementation; don't block)

1. **Spendee CSV format** must be verified with a real export (§11.3).
2. The Geist font package availability for Expo. Fallback: bundle TTFs (SIL OFL licence → include the licence file).
3. Bottom sheet library choice (`@gorhom/bottom-sheet` compatibility with the current Reanimated/Expo SDK). If
   incompatible, build `Sheet` on a `Modal` + Reanimated. Keep the `Sheet` component API stable either way.
4. Maximum supported transactions for in-memory calculations. If it becomes slow above 20k rows, push aggregation into SQL.
5. The prototype's avatar initials "MC" imply a user name. The POC uses the server `displayName` initials, or an icon when
   local-only.
