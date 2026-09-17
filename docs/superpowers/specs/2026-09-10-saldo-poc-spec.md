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
2. **Local-first, one account.** Every read and write is local, so the app is fully usable offline — but it needs an
   account on the user's own server, which is signed in to once at first run (§6.29 step 0). The account and the
   database are the user's, so requiring them is not a hosted dependency; a server-less variant is a later option, not
   part of this POC.
3. **Passkey authentication** against that self-hosted Next.js server, which is also what enables sync.
4. **Sync** of all data between devices through that server.
5. **Attachments** (receipt photos/PDFs) on transactions, synced.
6. **Import & export:** full JSON backup/restore, CSV export, CSV import (generic mapping + Spendee preset).
7. **i18n:** Italian (source copy from the design) and English.
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
- A first run with no network: sign-in is required, so the welcome screen says so instead of appearing broken.

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
| D23 | Amounts are typed on the **device keyboard**, not an in-app keypad | One less thing between the user and the number, and no screen space spent on keys the OS already draws. `keyboardType="decimal-pad"` gives digits and a separator; iOS adds a done button through `InputAccessoryView`, which Android has no primitive for (there the keyboard's own dismiss key and the form's save button serve). The trade is that the keyboard's separator follows the *device* locale, so `sanitizeAmountInput` accepts both `.` and `,`. |
| D22 | **TanStack Query is used for the network layer only** (auth + sync, phases 06–07), never for local reads | Local reads are already reactive through the `expo-sqlite` change listener, with SQLite as the single source of truth; a query cache on top would have to be invalidated by hand on every mutation, re-implementing what the listener does for free and inviting stale-screen bugs. React Query caches *server* state, and on a local-first device there is none. It earns its place on retries, backoff, dedup and `onlineManager` for the sync and auth calls, driven imperatively through `QueryClient` rather than by component mounts (§8.5 runs sync on app start, foreground and after writes, not on mount). |

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
| `language` | `system \| it \| en` | |
| `theme` | `system \| dark \| light` | Design default dark. |
| `onboardingCompletedAt` | ISO \| null | |

Device-local (not synced, stored in `expo-secure-store`/`AsyncStorage`): `appLockEnabled`, `serverUrl`,
`deviceId`, tokens, last sync cursor.

**Account**

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string 1–60 | |
| `type` | `cash \| checking \| debit_card \| credit_card \| savings \| investment` | Labels: Contanti, Conto, Carta di debito, Carta di credito, Risparmi, Investimenti. A debit card is its own account with its own balance, and behaves like `checking`. |
| `institution` | string ≤60 \| null | Shown as subtitle ("Intesa Sanpaolo"). |
| `openingBalance` | minor int | Balance at creation (may be negative for credit cards). |
| `includeInSpendable` | boolean | Default `true` for cash/checking/debit_card/credit_card, `false` for savings/investment. |
| `colorIndex` | int 0–9 | Index into `categoryColors`. |
| `icon` | IconName | Options: landmark, card, coins, piggy, trend, phone, briefcase, shield. |
| `creditCloseDay` / `creditChargeDay` | int 1–28 \| null | Only for `credit_card`. |
| `creditPaymentAccountId` | id \| null | Account the card is charged to. |
| `archivedAt` | ISO \| null | Archived accounts are hidden from pickers and totals; history stays. |
| `sortOrder` | int | |

**Category**

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string 1–40 | |
| `direction` | `expense \| income` | |
| `parentId` | id \| null | **One level only**: a child cannot have children, and a parent's direction must match. |
| `icon` | IconName | Picker groups in §6.13. |
| `colorIndex` | int 0–9 | |
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
| `frequency` | `monthly` | POC supports monthly ("Ogni mese") only. The field exists now so that adding `weekly` later is additive — no device migration and no new sync column. |
| `startDate` | LocalDate | Day of month used for every occurrence, clamped to the month length. |
| `endDate` | LocalDate \| null | Inclusive. |
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
- **Input is the device's numeric keyboard** (`decimal-pad`), not an in-app keypad. `sanitizeAmountInput(text,
  minorDigits)` normalises every edit: it accepts `.` or `,` (the system keypad follows the device locale, not the app
  language), treats only the first separator as the decimal point, drops anything that is not a digit or separator,
  strips leading zeros while keeping a lone `0`, and enforces max **8 significant digits** split by the currency scale
  — `maxIntegerDigits = 8 − minorDigits`, so 6 + 2 for EUR, 8 + 0 for JPY, 5 + 3 for KWD. A 0-decimal currency gets no
  fractional part at all.
- The field shows the raw buffer while typing, not a grouped number: re-formatting text under the caret fights the
  user. Grouping applies wherever an amount is *displayed*.
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

- **Cashflow (6 cycles):** for each of the last 6 cycles including the current one, show counted income (bar up, positive
  colour) and expenses (bar down, accent), with the net label above (`+123` muted, or `−123` accent, rounded to units).
  The current cycle's bars are hatched (45° stripes).
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
- **Tag:** a **ranking** of the cycle's tagged expenses — tag name, "N transazioni", amount — top 5, then "Tutti i tag"
  → the tag list. Tapping a tag opens the tag view (all dates, §5.10). Below it, "N voci senza tag · {amount}" and, from
  two tags up, the note that a transaction with several tags counts in each.
  **Never a split bar, a pie or a % of total:** tags are neither exclusive nor exhaustive, so the amounts overshoot the
  cycle's spend and still miss the untagged rows. `spendingByTag` returns the untagged total precisely so the card can
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
- **Home card:** top 3 budgets by `ratio` desc. Note: `"{n} oltre il ritmo"` if n > 0, else `"nei limiti"`.
- **Alerts:** when a write makes `ratio × 100` cross `alertThreshold` (from below), schedule an immediate **local
  notification** (`expo-notifications`): "Budget {name}: {pct}% usato". Notify once per budget per period (remember
  `lastAlertPeriodStart` device-locally).
- **Category taken rule:** in the new-budget grid, categories already in another budget show a dot and can't be picked
  (toast "«X» è già in un altro budget").
- **Budget detail sheet:** spent, "su {limit}", bar with pace tick, "Periodi precedenti" 6 bars (5 previous + current
  in accent), "Media 6 periodi".

### 5.9 Recurring transactions

- Toggling "Ripeti" in the new-transaction sheet creates a `Recurrence` whose `startDate` is the transaction date, plus the
  first occurrence (id = `${recurrenceId}:${date}`).
- **Materialiser** (`materializeOccurrences(recurrence, existingIds, horizonEnd)`): for each monthly date from
  `startDate` to `min(endDate, horizonEnd)`, if no row with the deterministic id exists (including tombstones), create it
  from the template. `horizonEnd = end of the cycle after the current one`. It runs on app start, on foreground, after
  sync pull, and after any recurrence write.
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

### 5.10 Tags

- Created inline from the transaction sheet's tag field ("Crea «X»"). The list is sorted by usage count desc.
- **Rename:** update `Tag.name` (ids unchanged).
- **Merge into another tag:** replace the source id with the target id in every transaction's `tagIds` (dedupe), then tombstone
  the source.
- **Delete:** remove the id from all transactions, then tombstone. Confirm inline: "Eliminare «X»? Le transazioni restano."
- **Tag view:** a tag spans all dates (the period selector doesn't apply). Shows total expenses, the line "Tutte le date,
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
| 6.1 | **Home** | 54–178 | Header: avatar initials (from display name, or "S" when there is none) → Profile — the only entry point the design gives the profile, and it belongs to the home header alone, not to the shared period header the other tabs use; period button (label + "giorno X di Y" / "ciclo chiuso") → Period sheet; ‹ › cycle nav. Cards, in this order: Remaining; **In arrivo** (only if upcoming exist, at most 5 shown, the header counting them all) — it sits second because it is what corrects the figure above it; Budget (top 3); Ultime transazioni (5). Each list card's **header is its action** (title, status, chevron, whole row tappable) rather than an accent line of text at the bottom. **Andamento del ciclo moved to Statistics** (§6.3), next to the six cycles it is a close-up of: it is the one card here that is read rather than glanced at. |
| 6.2 | **Transazioni** | 180–251 | §5.12. Title + period button, sticky search + chips. **The list shows what has happened**: everything dated after today is folded behind one "In arrivo" row carrying the count and the net, which expands the upcoming days in place rather than opening a screen — same rows, same swipes, and you are looking to glance, not to navigate. Only the selected period's upcoming, since that is all the query holds. Expanded, the two runs are separated by labelled rules ("Dopo oggi" / "Già registrate"), since the toggle row has scrolled away by the time the future ends. An **account filter** chip opens a single-select sheet (all accounts, archived included, one check) and is also seeded by the `accountId` route param, which is how "Ultime transazioni" on an account detail opens this list. |
| 6.3 | **Statistiche** | 253–350 | §5.7. |
| 6.4 | **Budget list** | 352–392 | Cards with icon, name, "N giorni rimasti" / "Periodo chiuso", spent/limit, bottom bar + pace tick; "+" and dashed "Nuovo budget". Tap → Budget detail sheet. |
| 6.5 | **Conti** | 394–469 | **Patrimonio complessivo first**, as the hero — it is the question the screen answers and it needs no explanation — with Totale spendibile under it on its own line plus a sentence saying what it leaves out (savings and investments); spendable list, "Risparmi e investimenti" list, Patrimonio complessivo, a **"Conti archiviati" row** with the count, opening `settings/archived-accounts` (the collapsible list of the prototype became that screen, so the Accounts tab and the Profile row lead to the same place). An archived account offers **Ripristina and nothing else**: its detail hides edit, transfer and archive, and `account/edit` refuses with the same restore button, since a deep link can still reach it. Header: settings gear, "+". |
| 6.6 | **Transaction detail** | 471–536 | Amount (44px), title, rows Categoria (dot), Conto (transfer: "A → B"), Data (long format with year), Nota (note, or "Ricorrente, ogni mese" / "Registrata manualmente"), Esclusa dai totali. Tag chips → Tag view. **Attachments:** "Scontrino"/"Allegati" horizontal list of 96×124 thumbnails, tap → full-screen viewer (pinch-zoom; PDFs open in the system viewer). "Modifica" → edit sheet. |
| 6.7 | **Impostazioni** | 538–584 | **Not built as a separate screen.** Every row of it is already in 6.8 Profilo — categories, tags, the period, the currency — and in the prototype the two screens differ only in how you reach them. The gear on Accounts opens the Profile, and "Rivedi la configurazione iniziale" moved there. One list, one place to change a setting. |
| 6.8 | **Profilo** | 586–669 | Inizio del ciclo, Valuta (row shows the **symbol** next to the code), Lingua, Tema — each one a **pushed screen** under `profile/`, not a bottom sheet: same place Categorie and Tag already went, and the only place the cycle footnote and the currency confirmation have room; Categorie, Tag, **Conti archiviati** (its own screen, `settings/archived-accounts`, with Ripristina per row — pushing the Accounts tab landed at the top with the archived accordion shut, which is not what the row promised; the accordion on the tab stays); **Server e sincronizzazione** (NEW row → `profile/server`); Importa transazioni (CSV) → import wizard; Esporta i dati (sheet: JSON backup, CSV transactions); **Ripristina backup** (NEW, JSON); Blocco con Face ID/biometria toggle; **Elimina tutti i dati** (NEW → `profile/delete-data`, §8.6); Esci (only when signed in: revoke refresh token, keep local data, stop sync); version from `expo-application`. |
| 6.9 | **Categorie** | 671–727 | §5.11. |
| 6.10 | **Account detail** | 729–804 | Edit, archive (confirm toast), icon/name/kind, balance, delta over last 8 months, sparkline of month-end balances over 8 months (labels first/last month), credit card box, cycle income/expense tiles, "Trasferisci verso un altro conto" → new transfer sheet, last 6 transactions. |
| 6.11 | **Tag view** | 807–857 | §5.10. |
| 6.12 | **Category detail** | 859–934 | §5.7. |
| 6.13 | **Tag admin** | 936–957 | List with count; tap → Modifica tag sheet. Footnote copy from design. Reached from Profilo as **"Gestisci i tag"**: reading what a tag cost belongs to Statistiche (§5.7), this screen is for renaming, merging and deleting. |
| 6.14 | **Tab bar + FAB** | 961–975 | Height 78 + bottom inset; FAB 56×56, radius 18, accent, raised −16px. FAB opens new transaction sheet. |
| 6.15 | **Period sheet** | 981–1009 | Lists the last five periods ending with the selected one (current first, with a check on the selected one; sub "in corso, giorno X di Y" or "{expenses} di uscite"); then **Periodo personalizzato** (date range picker, `start <= end`), **Tipo di periodo** (mese / settimana / ciclo di stipendio / anno → writes `settings.periodKind`) and, under the cycle kind only, **Giorno di inizio ciclo**. Remove the prototype's "non disponibile offline" rows (everything is local). | **Forward navigation stops one period after the current one** (`canShiftPeriod`): that far there are materialised recurrences (§5.9) and any future-dated transaction the user entered, and past it every screen is empty by construction. The › arrow greys out rather than opening nothing. A custom range is not bound by this: asking for a future window is explicit.
| 6.16 | **New/Edit transaction sheet** | 1011–1174 | Kind segmented (Uscita/Entrata/Trasferimento); amount display (tap reopens keypad in edit mode); category grid 4 cols (**top 7** by usage + "Altro" → full picker incl. subcategories; seven plus the tile is two rows, which is what keeps the account, the date and the tags above the fold — ten was three rows and hid them); account chips (non-archived) **and** the date row **above** the category grid, since both are set on nearly every transaction and the grid used to bury them; transfer Da/A pickers; date chips Oggi/Ieri + Saldo's own calendar sheet (not the platform picker); Descrizione (placeholder "Dove"/"Da chi"); Tag input with suggestions, create, selected chips; **Allega foto** (action sheet: Scatta foto / Scegli dalla libreria / Scegli file PDF; shows count badge + thumbnails); Ripeti toggle; Escludi dai totali toggle + footnote; Elimina (edit only). The amount is a `decimal-pad` field styled as the big amount, focused automatically on a new transaction (D23); there is no in-app keypad and no separate save column. Save is disabled until amount > 0, an account is chosen, a non-transfer has a category and a transfer has a different destination. |
| 6.17 | **Budget detail sheet** | 1176–1209 | §5.8. Add "Modifica" (opens budget form prefilled) and "Elimina budget". |
| 6.18 | **New budget sheet** | 1211–1283 | **New is a three-step wizard** (categorie → importo → dettagli), edit stays one page: six decisions on one screen meant the ones below the fold were missed, and the median suggestion is computed from the categories, so it cannot be offered before them. Amount input + currency symbol, median hint + "Usa", category grid 2 cols with taken dots, Nome (auto placeholder), Si ripete segmented, Avvisami a segmented + note, Porta avanti il residuo toggle, footnote ("+12% sulla mediana di spesa"), "Crea budget" disabled until valid. Reused for edit ("Salva"). |
| 6.19 | **Category sheet** | 1285–1362 | Preview tile, name, icon search + grouped grid (7 cols; groups Casa, Trasporti, Cibo, Salute, Svago, Lavoro with search labels from design `ICON_LABEL`, translated), 10 colour swatches with ring, Categoria madre picker (only top-level, same direction; hidden if the category has children), Budget mensile toggle + amount, Archivia (edit only), Salva disabled until name. |
| 6.20 | **Archive category sheet** | 1364–1384 | §5.11. |
| 6.21 | **Recurrence scope sheet** | 1386–1403 | §5.9. |
| 6.22 | **Account sheet** | 1405–1481 | Balance display with keypad, name, type grid 3 cols, credit close/charge day pickers, colour swatches + 8 icons, "Includi nel saldo disponibile" toggle + note, Salva. In edit mode, the amount edits **current balance**: store `openingBalance = entered − Σ(transaction effects)`. |
| 6.23 | **Tag filter sheet** | 1483–1502 | Multi-select by usage, Azzera / Fatto. |
| 6.24 | **Tag edit sheet** | 1504–1543 | §5.10. |
| 6.25 | **Currency sheets** | 1545–1579 | §5.1. The design lists four currencies; with 162 supported the sheet needs a **search field** and a "Comuni" section (`COMMON_CURRENCY_CODES`) above the alphabetical list. Rows show code, symbol and localised name. |
| 6.26 | **Delete dialog** | 1581–1592 | Centered card, scrim 0.6. |
| 6.27 | **Toast** | 1594–1601 | Bottom 92px above tab bar, 4s (5s with undo). |
| 6.28 | **Attachment viewer** | 1603–1614 | Black full-screen, close button, pinch zoom, swipe between attachments, share, delete attachment. |
| 6.29 | **Onboarding** | 1616–1717 | Step 0 **Welcome** (not in design; same visual language: 32px title, muted body): the app needs an account on the user's own server, and the build already knows which one (§15), so this screen only names the server and offers passkey sign-in, plus "Crea account" when the server allows it. A build without a usable `SALDO_SERVER_URL` says exactly that and offers nothing. On success it pulls; if the server already has settings with `onboardingCompletedAt`, the rest is skipped. With no network it says so — sign-in is required, so a first run offline cannot proceed. Then **four steps**: 1 **period** (four kinds, with the 7-col day grid revealed only for the pay cycle, and the "il tuo periodo va dal X al Y" timeline), 2 account details (name, and the type as a three-column grid of tiles offering all six types, icon over label), 3 current balance + currency, 4 categories. Steps 2 and 3 are split so each screen asks one thing and the balance gets the whole screen with the keyboard up. Progress bar 2px. "Inizia" writes settings + account + categories. |
| 6.30 | **Server & sync** (NEW) | — | The configured server address, read-only, status (Non connesso / Connesso come {name} / Ultima sincronizzazione {relative time} / Errore), "Sincronizza ora", "Esci", pending changes count, attachment upload queue count. |
| 6.31 | **Import wizard** (NEW) | — | §11.3 steps, each a full screen with a sticky bottom CTA. |
| 6.32 | **Lock screen** (NEW) | — | App icon + "Sblocca" button; auto-prompts biometrics (`expo-local-authentication`) on cold start and after 60s in background when enabled. Falls back to device passcode. |

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
  `serverUrl`, `syncCursor`, `syncEpoch`, `dataResetNotice`, `appLockEnabled`, `lastAlertPeriodStart:{budgetId}`.
- **Dev seed:** in `__DEV__` builds, Profile shows "Carica dati demo". It generates data equivalent to the design mock
  (`CYCLES`, `TAG_EXTRA`, `ACCOUNTS`, `BUDGETS`) shifted so the current cycle contains today.
- Optional hardening (documented, not required): enable SQLCipher via the `expo-sqlite` config plugin
  `useSQLCipher: true` with a key from secure store.

---

## 8. Sync

### 8.1 Model

- Unit of sync = one entity row (whole-row last-writer-wins).
- Entity names: `settings, account, category, tag, transaction, recurrence, budget, attachment`.
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
  an expired session it refuses and asks to sign in again. A build with no server deletes the phone only.
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
| `REGISTRATION` | `invite` | `open` \| `first-user` (only when no users exist) \| `closed` \| `invite` (§9.5). |
| `APP_REDIRECT_SCHEMES` | `saldo` | Comma list of allowed custom schemes for mobile redirects. |

### 9.3 Mobile sign-in flow (browser ceremony + one-time-token handoff)

A passkey ceremony needs `navigator.credentials`, which React Native does not have (§9.4), so it runs on a page the
server serves and the resulting session is handed to the app.

1. App: the server is the one the build points at (§15), so nothing is asked for. The sign-in screen calls
   `GET /api/health` on mount, which must return `app: "saldo"` and `apiVersion: 1`; it also returns `schemaVersion`
   (§8.1) and `registrationAllowed`, which decides whether "Crea account" is offered. A failed check does not disable
   "Accedi con passkey" — it may be transient, and the ceremony reports its own error — it only offers "Riprova".
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

Wizard steps (screens in `profile/import`):

1. **File:** `expo-document-picker` (`text/csv`, `text/comma-separated-values`, `*/*` fallback). Parsed by
   `@saldo/core/io`'s own `parseCsv` (auto-detects `,` `;` `\t` outside quotes, strips a BOM, accepts `\n` and
   `\r\n`) rather than PapaParse: the rules are the ones `toCsv` already writes, and `@saldo/core` imports nothing.
2. **Preset detection:** match headers to a preset: `saldo` (own export, auto-mapped), `spendee`, else `generic`.
3. **Mapping** (generic, or to confirm a preset): required `date`, `amount`; optional `type`, `account`, `category`,
   `description`, `note`, `tags`, `currency`. Options: date format (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`,
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
- Unknown accounts are created as `checking`, `openingBalance 0`, `includeInSpendable true`.
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
  `en.ts` must have the identical key structure (type-checked and unit-tested).
- Keys are namespaced by feature: `common.*`, `tabs.*`, `home.*`, `transactions.*`, `txForm.*`, `stats.*`,
  `budgets.*`, `accounts.*`, `categories.*`, `tags.*`, `settings.*`, `profile.*`, `onboarding.*`, `sync.*`,
  `auth.*`, `import.*`, `export.*`, `errors.*`, `seed.*` (seed category names), `icons.*` (icon search labels).
- Interpolation `{{name}}`. Plurals use i18next `_one` / `_other` suffixes (Italian and English both need only these).
- Guillemets «» are used in Italian copy. English uses curly double quotes “ ”.
- `resolveLocale(preference, deviceLanguages)` → `it` if preference `it`, or `system` and the first device language
  starts with `it`; otherwise `en`.
- Deterministic formatters (`@saldo/i18n/format`): `formatMoney`, `formatMoneyParts`, `formatDayMonth`
  (it `18 apr`, en `Apr 18`), `formatCycleRange` (it `27 mar – 26 apr`, en `Mar 27 – Apr 26`), `formatLongDate`
  (it `18 aprile 2026`, en `April 18, 2026`), `formatPercent`, `formatRelativeTime` (sync status, coarse:
  now / N min / N h / date).
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
| `SALDO_SERVER_URL` | — (**required**: the server this build signs in to, e.g. `saldo.example.com`) |

The address is a build input, not something typed on the phone: an app belongs to one server. It
reaches the app through `extra.serverUrl` and is validated at runtime with `normaliseServerUrl`; a
build without a usable value can only say so (§6.29 step 0).

**Android APK (docs/building-android.md):**

1. Prerequisites: JDK 17, Android SDK + platform tools, `ANDROID_HOME`.
2. `pnpm install` then
   `SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile exec expo prebuild --platform android --clean`.
3. Generate a keystore: `keytool -genkeypair -v -storetype PKCS12 -keystore saldo-release.keystore -alias saldo -keyalg RSA -keysize 2048 -validity 10000`.
4. Put `SALDO_UPLOAD_STORE_FILE`, `SALDO_UPLOAD_KEY_ALIAS`, `SALDO_UPLOAD_STORE_PASSWORD`, `SALDO_UPLOAD_KEY_PASSWORD`
   in `~/.gradle/gradle.properties`. A config plugin in `apps/mobile/plugins/withReleaseSigning.js` wires
   `signingConfigs.release` so it survives `prebuild --clean`.
5. `cd apps/mobile/android && ./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk`.
6. Install: `adb install -r app-release.apk`, or copy it to the phone and allow "install unknown apps".
7. Convenience script: `pnpm --filter mobile build:android`.

**iOS (docs/building-ios.md):**

1. Prerequisites: macOS, Xcode (current), CocoaPods, an Apple ID.
2. `SALDO_BUNDLE_ID=com.<you>.saldo SALDO_SERVER_URL=saldo.example.com pnpm --filter mobile exec expo prebuild --platform ios --clean`.
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

### 17.1 Web app

- `apps/web` gains authenticated pages (same passkey login, cookie session) and renders with DOM components using
  `@saldo/ui` tokens and `@saldo/i18n`.
- Data: either query `sync_rows` JSONB server-side through `@saldo/core` calculations, or run local-first in the
  browser (SQLite WASM + the same sync client). Decide in a dedicated spec.

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

---

## 18. Security & privacy checklist

- No telemetry, analytics or third-party network calls from the app except the server this build was configured for
  (`SALDO_SERVER_URL` at build time — §15 — not an address typed on the phone) and, in the future, the user-configured
  AI provider.
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
