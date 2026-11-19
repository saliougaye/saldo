# Redesign v2 — implementation tasks

This file lists every task that turns the confirmed redesign mockups into the real web app and the real
phone app (Expo). Tick a box when its task is merged.

## 0. Sources, rules and order

### 0.1 The mockups

The mockups are in `docs/design/redesign-v2/`. That folder is gitignored, so only the maintainer's machine has
it. Each file opens from disk and shows the desktop window and the phone side by side. The phone frame is the
layout of the Expo app and of the mobile browser. Each file has only the `Confirmed` variant left, and its info
panel (the `i` button) lists the decisions.

| Feature | File | Sources |
| --- | --- | --- |
| Home | `home-registro.html` | edited in place |
| Transactions | `transazioni.html` | `.src-transazioni/` |
| Statistics | `statistiche.html` | `.src-statistiche/` |
| Accounts, archive | `conti.html` | `.src-conti/` |
| Profile, settings, categories, tags, recurrences, CSV import, admin | `profilo.html` | `.src-profilo/` |
| Create, edit, archive, close, delete | `nuovo.html` | `.src-nuovo/` |
| Sign in, register, first run | `accesso.html` | `.src-accesso/` |

To rebuild a mockup, run `python3 build.py ../.base/home-registro.base.html ../<file>.html` in its sources
folder. Do not pass `home-registro.html` itself: the build reads line ranges from the frozen copy in `.base/`.

### 0.2 Rules for every task

- Follow `AGENTS.md`: TypeScript strict, money in minor units, `LocalDate`, business rules in `@saldo/core`,
  every string in `packages/i18n/src/locales/it.ts` and `en.ts`, tokens from `@saldo/ui`.
- Keep the colours and the icons. The redesign changes the layout and the behaviour, not the palette.
- Every web page works at 1280, 1024 and 834 px wide and at 390 px. The mockups have a width switch.
- On the phone there are no tooltips. A tap opens what a tooltip shows on the desktop.
- Confirm a removing action with a small window on the desktop and a bottom sheet on the phone. Put a dimmed
  overlay under both. The confirm button is the primary button (`--ink`), never red. After the action, the toast
  has «Annulla».
- On the desktop a form opens in place of the detail or of the page. The only exception is a new transaction in
  Home and Transactions: it uses the inline composer. On the phone a form is a bottom sheet.

### 0.3 Order and parallel work

One feature is one branch and one pull request, with the web and the Expo app together. They share the core
rules, the strings and the design decisions, so a reviewer sees the whole feature at once.

```
Track A (web)    1. local-first web ──┐
                                      ├──► 3. features: each one = core + strings + web + Expo + tests
Track B (shared) 2. components, both ─┘
```

- Phase 1 is for the web only: the Expo app is already local-first. It does not block the Expo half of a feature.
- Phase 2 builds the shared pieces on both platforms. Start it at the same time as phase 1.
- In phase 3, the Expo half of a feature can merge before phase 1 is done. The web half of a feature needs
  phase 1 (1.4 and 1.5) and its pieces from phase 2.
- Two agents can work on one feature at the same time: one on `apps/web`, one on `apps/mobile`. Merge the
  `@saldo/core` rules and the strings of the feature first, in their own commit, so both halves build on them.

## 1. Foundation: a client-side, local-first web app (web only)

The current web app renders on the server (`readPage`, Server Actions). The redesign wants the web app to load
once, keep the user's data in the browser and sync it, like the phone.

- [ ] **1.1 Write the spec.** Write `docs/superpowers/specs/YYYY-MM-DD-web-local-first.html` from the template.
      Cover the browser store, the sync loop, auth, the first load, offline, and what stays on the server
      (admin, MCP, mail, setup). Include diagrams.
- [ ] **1.2 Share the sync client.** The phone has the push/pull client, the local store and the scheduler in
      `apps/mobile/src/sync/`. `packages/*` must not import from `apps/*`. Move the platform-free part into a
      package and keep the storage adapters in each app. Make sure the phone sync tests still pass.
- [ ] **1.3 Browser store.** Keep the user's rows in IndexedDB (or SQLite in WebAssembly, as decided in 1.1).
      Use the same entities, HLC and last-writer-wins rules as the phone. Write integration tests with the PGlite
      harness for push and pull.
- [ ] **1.4 Client data hooks.** Read `UserData` from the browser store and feed the existing pure views
      (`src/features/*/…View.ts`) and `@saldo/core`. Screens do not call the server to read.
- [ ] **1.5 Local writes.** Replace the Server Actions under `src/server/write/` with local writes and a push. Keep
      the server validation in the sync endpoint.
- [ ] **1.6 App shell.** Render the four pages and Profile on the client. Navigation does not reload the page.
- [ ] **1.7 Loading.** Show the skeleton with the real shapes only on a cold open. Later navigations are instant.
      The sync state («Sincronizzato», «Salvato sul dispositivo · sincronizzo…») shows in the page head.
- [ ] **1.8 Offline.** The app opens and writes offline (the PWA in `src/pwa/` already caches the shell). Writes
      queue and push when the network returns.
- [ ] **1.9 Remove the server-rendered pages** after each client page replaces them: `PanelSwitch`, the
      `readPage` page loaders and the write Server Actions that nothing uses.

## 2. Shared components (web and Expo, in parallel)

Build each piece on the web (`apps/web/src/ui/`) and on the phone (`apps/mobile/src/components/`), with the
tokens from `@saldo/ui`. Each line below can be two parallel tasks. Use the `animate-expo` skill for sheets,
gestures and press feedback on the phone.

- [ ] **2.1 Layouts.** Web: top bar, «list + detail», sticky left column with a scrolling right column, Profile
      menu layout, narrow rules for 1024 and 834 px. Expo: the screen frame with the period head.
- [ ] **2.2 Figure card.** Icon in a circle, label, hero amount with small decimals, one or two lines under it.
- [ ] **2.3 Add a transaction.** Web: inline composer with one-click popovers — Categoria, Conto (with balance),
      Data (Oggi, Ieri, month calendar up to 6 months back), Tag (multi-select with «Nuovo tag»), Nota. A date in
      an earlier period saves into that period and the toast names it. Expo and mobile web: the add bar that
      turns into a floating button on scroll, and the sheet where the Conto and Data chips open a picker.
- [ ] **2.4 Confirm window (web) and confirm sheet (Expo).** Overlay, title, body, optional choices or a typed
      confirmation, primary button.
- [ ] **2.5 Toast with «Annulla».** 5 seconds. Used after save, archive, close, delete, restore, import.
- [ ] **2.6 Form pieces.** Amount field, chips, category grid, colour and icon pickers, day stepper, period kind
      tiles, account radio list, switch row, live summary box («Totale spendibile: … → …»). Web: the form in place
      of the detail. Expo: the form sheet with Annulla / Crea on top.
- [ ] **2.7 Charts.** Follow the `dataviz` rules (legend, hover tooltip on the desktop, tap on the phone, 2 px
      gaps, ≤ 6 colours plus «Altre»). Web in SVG, Expo with `react-native-svg`:
  - periods bars with the green income tick, the forecast and its range; horizontal scroll with ‹ › on the phone;
  - daily bars stacked by category with the outlier cut (desktop), daily calendar heat grid (phone);
  - Sankey with three columns (Entrate → Fisse / Variabili / Restano → categories), filled ribbons;
  - donut with list, diverging bars («Rispetto al solito»), tag bars;
  - sparkline and 8-month line.

## 3. Features

Each feature is one block. Do its tasks in this order inside the block: **core** (unit tests first), **strings**
(`it.ts` and `en.ts`, then the parity test), then **web** and **Expo** in parallel, then **tests**. When a
feature changes a screen that the marketing site shows (spec 0.8a §04), update
`apps/site/src/components/phone/screens/` in the same pull request.

### 3.1 Home — `home-registro.html`

- [ ] **Core.** Pace of «Rimasto»; budgets at risk (reuse what exists).
- [ ] **Web.** «Agenda v2»: left sticky card (Rimasto with pace, month calendar with whole euros, up to two budgets
      at risk, «Tutti i budget»); right list box with the composer bar on top. The chosen day filters the list and
      presets the date. «In arrivo» collapsed at the bottom. Left card 320 px at 1024, 288 px at 834.
- [ ] **Expo** (`app/(tabs)/index.tsx`). Summary, budget chips, week calendar that opens to the month, list by
      day, add bar / floating button and the add sheet of 2.3.
- [ ] **Both.** Empty states: first run («Per iniziare», four steps), new period, no budget, empty day, future
      day.
- [ ] **Tests.** Playwright: add a transaction with the popovers. Maestro: `onboarding-and-first-expense.yaml`,
      `period-navigation.yaml`.

### 3.2 Transactions — `transazioni.html`

- [ ] **Web.** Facet column (search, type, top 5 categories with «Mostra tutte», accounts, tags as checkboxes);
      list by day with the summary line and filter tokens; edit inline in the row; composer with popovers.
      Keyboard: ↑ ↓ / J K, ↵, N, /, ⌘↵, Esc. Facets 220 px at 1024; at 834 they fold into a «Filtri» popover.
- [ ] **Expo** (`app/(tabs)/transactions.tsx`, `app/transaction/`). Search, «Filtri» sheet with the same facets,
      list by day, edit sheet.
- [ ] **Both.** States: full, loading, no results (shows the periods where the search matches), empty. Delete
      with «Annulla».
- [ ] **Tests.** Playwright: filter, edit, delete and undo. Maestro: `transfer-and-settlement.yaml`,
      `edit-recurring-following.yaml`.

### 3.3 Statistics — `statistiche.html`

- [ ] **Core.** The usual at the same day: for each category, the median of the last 6 closed periods summed up
      to the same day index; the per-category gaps add up to the total gap. End-of-period estimate with a
      min–max range, and the daily amount that keeps the balance above zero or within the usual.
- [ ] **Web.** Left sticky column with four figure cards (Uscite finora with the gap and the category that
      explains it, Entrate, A fine periodo, Spese fisse); right column with Periodi (Uscite / Restano), Giorno per
      giorno (bars), Sankey, donut and «Rispetto al solito» side by side, «Per tag». Sticky category filter bar.
      Left column 260 px at 1024; at 834 the cards go in a 2 × 2 grid on top.
- [ ] **Expo** (`app/(tabs)/stats.tsx`). Figure cards in a column (Spese fisse compact), Periodi with scroll and
      ‹ ›, calendar heat grid, Sankey, donut with list.
- [ ] **Both.** A tap or click on a day, or «Vedi le spese» with a category, opens the expenses under the chart.
- [ ] **Tests.** Playwright: filter by category, open a day. Maestro: a new stats flow.

### 3.4 Accounts and archive — `conti.html`

- [ ] **Core.** Archived accounts count in the net worth; restore; an account with open goals cannot be archived.
- [ ] **Web.** «Dettaglio accanto»: left card with net worth in short, spendable total, groups, goals; right card
      with the chosen account's detail (balance, goals split, Entrate / Uscite figure cards, credit card cycle and
      «Salda carta», 8-month line, last transactions). «Archivio» at the bottom of the list opens in place.
      List 340 px without sparklines at 1024; at 834 one column, and the detail opens as a page with «‹ Conti».
- [ ] **Expo** (`app/(tabs)/accounts.tsx`, `app/account/`, `app/profile/archived-accounts.tsx`). Worth card
      without the group bar, groups, goals; full-screen detail; «Archivio» page with closed goals.
- [ ] **Both.** Archive detail is read-only, with «Ripristina» and «Annulla».
- [ ] **Tests.** Playwright: open an account, archive and restore. Maestro: `amount-keypad-and-credit-card.yaml`.

### 3.5 Create, edit, archive, close, delete — `nuovo.html`

- [ ] **Core.** Goal pace: the monthly amount needed to reach the target by the deadline; behind / ahead.
- [ ] **Both.** New account: type first, then name, balance, «Includi nel totale spendibile», colour and icon,
      bank; credit card close and charge days and the paying account; the live box shows the new spendable total.
- [ ] **Both.** New goal: presets, name, target, deadline, account, amount already saved; the live box shows the
      monthly amount. New budget: category (disabled when it has a budget), limit with «Il solito» suggestions,
      pace bar.
- [ ] **Both.** Edit forms: the same forms filled in; the account type cannot change. Archive account, close goal
      (money goes back free, or record an expense), delete budget — with the confirm window / sheet and
      «Annulla».
- [ ] **Web.** Forms in place of the detail. «Nuova transazione» from an account's detail opens the full form in
      place, with that account chosen.
- [ ] **Expo** (`app/account/`, `app/goal/`, `app/budget/`). Forms as sheets.
- [ ] **Tests.** Playwright: create, edit, archive with undo. Maestro: `goal.yaml`, `budget.yaml`.

### 3.6 Profile and settings — `profilo.html`

- [ ] **Core.** Recurrence monthly average (monthly equivalent of each cadence, fixed share of fixed income, next
      dates). CSV import value matching (the file's categories and accounts to existing ones, or create new):
      extend the existing CSV parser tests.
- [ ] **Web.** Menu left in groups (Account, Organizza, Connessioni e dati, Admin for admins), page right, opens on
      Preferenze. Categories, tags, recurrences, import and admin details open in place of the page.
- [ ] **Expo** (`app/(tabs)/profile.tsx`, `app/settings/`, `app/profile/`, `app/(tabs)/recurrences.tsx`). Grouped
      list with a hint under each item; pages and form sheets.
- [ ] **Both.** Preferenze: theme (applies at once), language, period kind and cycle start day with «Il periodo in
      corso», currency, time zone.
- [ ] **Both.** Categories and tags: sub-categories under the parent, reorder with up / down, archive with
      «Sposta e archivia» when transactions use the category; tag rename, merge, delete.
- [ ] **Both.** Ricorrenti (new on the web): monthly average, groups by cadence, «Finite»; edit (amount, name,
      cadence with the next dates, end, scope) and «Interrompi».
- [ ] **Both.** CSV import in steps: File → Colonne → Anteprima (summary, error rows, match the file's categories
      and accounts) → Importa → result.
- [ ] **Web.** Admin: accounts (detail, promote, revoke / restore, delete with the typed email), invites (the code
      once, with copy and QR; revoke), instance, server settings (name, registration mode, SMTP with a test
      email), MCP switch with usage numbers. Passkey, Connettori, Dati pages with the content of today.
- [ ] **Tests.** Playwright: change the period, archive a category with move, import a CSV, admin delete. Maestro:
      `settings.yaml`, `categories.yaml`, `tags.yaml`.

### 3.7 Sign in, register, first run — `accesso.html`

- [ ] **Web.** «Modulo e anteprima»: questions on the left, one at a time, with steps and «Indietro»; on the
      right, during the first run, a preview of the Home that fills as the user answers; during sign in and
      register, what Saldo offers. Sign in with passkey, «Ho perso la passkey»; register: invite code → name and
      email → passkey.
- [ ] **Expo** (`app/(onboarding)/`). One question per screen, steps on top, big button at the bottom. Keep the
      app-only steps (welcome, server, permissions).
- [ ] **Both.** First run: how to start (fresh / import / restore) → period → cycle day → first account →
      balance → categories → done → Home with «Per iniziare». Error states: wrong invite code, email already
      used, passkey window closed.
- [ ] **Tests.** Playwright: register and first run. Maestro: `onboarding-and-first-expense.yaml`, `guide.yaml`.

## 4. Docs

- [ ] **4.1** Update `docs/self-hosting.md` if the client-side web app changes what the server must serve or
      cache.

## 5. Done when

- [ ] Every web page matches its `Confirmed` mockup at 1280, 1024, 834 px and at 390 px, in the light and the dark
      theme. Navigation does not reload, and the web app opens offline.
- [ ] Every Expo screen matches the phone frame of its mockup, and its Maestro flow passes.
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass (read the output, see «Reading the results» in
      `AGENTS.md`), and the Playwright suite passes with the `e2e` label.
