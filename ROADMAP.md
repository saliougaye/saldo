# Roadmap

Where Saldo goes after the proof of concept, in the order the work has to happen. Each milestone is a
coherent release a self-hoster can update to. Milestone numbers are an order, not version numbers. The
product milestones come first; going public and releasing come last, once the feature set is what the
repository will be judged on.

This file holds the big directions. Bugs, small features and ideas that fit in one plan live in
[`TODO.md`](TODO.md); the POC phases that are already built, with their plans and acceptance criteria, live
in [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md). When a milestone is picked up
it gets a spec section and a plan under `docs/superpowers/plans/` like any other piece of work, and this
file records what was decided.

Every milestone keeps the rules that make Saldo what it is: local-first on the phone, integer money,
business rules in `@saldo/core` with tests first, no third-party call the user did not ask for. Where a
milestone bends one of them, the bend is written down here before it is built.

## The order, and what actually constrains it

```
0.1 Everyday features ──> 0.2 Forecast ──> 0.3 Web app ──> 0.4 MCP server ──> 0.5 AI on the server ──> 0.6 Shared ledger ──> 0.7 Public ──> 0.8 Releases
```

Only four things in this order are dependencies; everything else is preference and can move.

| Before | After | Why |
|---|---|---|
| Forecast (0.2) | AI insights (0.5), the MCP forecast tool (0.4) | they consume its aggregates |
| **Deciding** the shape of the shared ledger | Web app (0.3), MCP (0.4) | every server-side query is scoped by the answer |
| Whichever of web app, MCP, AI comes first | the other two | it builds the server-side projection they all read |
| Everything | Public (0.7) → Releases (0.8) | a decision, taken 2026-09-22 |

Two decisions taken on 2026-09-22 shape the whole list:

- **The server reads the user's data.** Saldo is self-hosted: the server is the user's own machine, and
  `SECURITY.md` already says «you trust your own server». So the web app renders server-side, the AI key
  lives on the server, and the MCP endpoint answers from the server. The server stops being a blob store and
  gains its first application logic on rows: one **typed projection** of `sync_rows` through `@saldo/core`
  (D11 foresaw it), built once by 0.3 and reused by 0.4 and 0.5.
- **Therefore no end-to-end encryption.** Encrypted rows cannot be projected, aggregated or sent to a model.
  Recorded in «Considered and not planned» at the end with the reasoning, so it is not re-derived.
---

## 0.1 — Everyday features: small, useful, self-contained

Features a user notices on the first day, each one plan on its own and independent of the server-side work
that follows. Moved here from `TODO.md` on 2026-09-22.

### Goals: saving towards a target

Example: putting money aside to buy a car — «Macchina, 12.000 € entro giugno 2027».

Budgets cannot do this, and bending them would break them: a budget is a **ceiling on spending** — `spent` is the sum
of counted expenses in a category (§5.8), the bar fills as money goes *out*, and rollover only carries the unspent part
of a limit. A goal is the opposite shape: a **target to accumulate**, with a deadline, filled by money put aside.

What exists today is half of it: a `savings` account (§3, excluded from Totale spendibile) plus transfers into it
already model "money set aside"; what is missing is the target, the deadline and the progress.

- [x] Decide the model before planning (2026-09-24, spec D24, D25, §5.13, §5.14):
  - **A goal is a pocket**: an account of type `pocket` inside a real account (cash, checking, debit card, savings),
    carrying the target and an optional deadline. Setting money aside is a transfer into it, so one current account is
    enough and one account can hold several goals. Pocket and goal are created and closed together. Investment
    accounts cannot hold pockets.
  - The **on-track rule** runs from the balance on the day the goal was created to the target on the deadline; the
    sentence asks for `(target − saved) ÷ periods left`, in the app's own period.
  - It lives on **Home**, in a target card shared with Budget (one featured item, exceptions as rows, «Tutti …» row of
    rings), in its own list reached from Profile, and on the goal detail.
  - Reached goals stay on Home until closed; expired ones ask to move the deadline or close. Closing offers «Registra
    la spesa» or returns the money to the parent, then archives the pocket, always at zero balance.
  - Accounts holding pockets show the bank balance, with the pockets indented under them and a «liberi» line.
- [x] Spec section (§5.13 Target cards, §5.14 Goals and pockets).
- [x] Plan A: the target card, with the Home Budget card moved onto it (budget rules unchanged).
- [ ] Plan B: pockets and goals, reusing the target card.

### Period recap: close the last period before the next one starts

Asked for on 2026-09-22. On the first day of a new period — the day after the old one ended — the app shows a recap
of the period that just closed, and only then the Home of the new one. Today the switch is silent: at midnight the
Home, the budgets and the stats move to the new period and the closed one is only reachable by paging back.

"Period" is whichever the user picked (§5.2: month, week, pay cycle, year), not only the pay cycle; the recap follows it.

What the recap shows, all of it already computable from what exists:

- income, expenses and the net, against the previous period and the 6-period average (`stats.ts`, `previousPeriods`);
- the top categories, and the one that moved the most against its average;
- budgets: which stayed within the limit, which went over, and what rolls over into the new period
  (`rollover.ts`);
- the biggest single expense, and the net-worth change over the period.

How it behaves:

- **When.** On the first open on or after the first day of the new period, once per period (remember the last
  period recapped device-locally, like the budget alerts' `lastAlertPeriodStart`). An optional local notification
  the morning of that day ("Il tuo {periodo} si è chiuso: guarda il riepilogo") reuses the §5.8 permission.
- **Where.** A full-screen sheet over the Home, dismissed with one button ("Inizia il nuovo {periodo}"). After that
  the recap stays reachable from the Home (a card for the first days) and from the period history.
- **Computed, never stored.** A transaction entered late for the old period changes the recap, as it changes the
  stats. One pure function in `@saldo/core` (`periodRecap(def, range, txs, budgets, …)`), TDD, and the screen only
  renders it.

- [ ] Decide before planning:
  - the weekly period: a recap every Monday may be too often (suggested: a lighter card, no sheet, no notification);
  - full-screen sheet, or a Home card only;
  - whether the recap can be shared as an image (a nice-to-have, not the POC's habit).
- [ ] Spec section (`§5.x Period recap`) and a design pass (not in the prototype), then the plan.

Later, the AI insights of 0.5 can add a sentence to it; the recap itself needs no server.

### A first run with no server (local-only), sign-in later

Spec §1.1 goal 2 keeps «a server-less variant» as a later option, and the code still carries half of it:
`apps/mobile/src/boot/decide.ts:31,74` sends a signed-in phone with no scheduler straight to onboarding,
`src/sync/SyncProvider.tsx:51` reads a null scheduler as «local-only», and `src/sync/scheduler.ts:50` and
`src/sync/syncContext.ts:6` document the same state. None of it is reachable: `decide.ts:70` routes every
signed-out session to welcome, and welcome offers only sign-in (phase 08).

Why it matters for an open-source app: the README's quick start asks for an HTTPS domain, a running server, an
invite code and a self-built app **before the first transaction**. For something described as local-first and
«own your data», that is the highest bar in the category, and the first five minutes decide whether anybody comes
back. The offline part already works; what is missing is the door.

This reopens a decision taken at 08 (sign-in required), so it is a product call, recorded here rather than argued:

- Welcome gains «Start on this phone»; sign-in stays on the same screen and in Profile for later.
- Phase 10b's ownership question gets a third case: local rows exist, no `kv.accountId`, and somebody signs in —
  adopt the rows into the account (push them) or discard them. Today's `ownershipVerdict` only knows a device with
  a recorded account and a device with none.
- §1.2's last bullet («a first run with no network … says so instead of appearing broken») and §6.29 step 0 change
  wording; §1.1 goal 2 loses its «later».
- A build with an empty `SALDO_SERVER_URL` becomes a legitimate local-only build instead of one that «can only
  say so» (§15).

### Mascot states

Moved here from `TODO.md` on 2026-09-22. The mark is Rocky, the 3D raccoon generated in
github.com/saliougaye/mascots (branch `mascot/saldo`); the app icons, splash and favicon in `apps/mobile/assets/`
are copies of its `out/saldo/icons/`.

The kit also carries Lottie state animations and illustrations (empty, loading, error, success, thinking, idle).
The empty states (§13) are the obvious first use: variant D of their design review would replace `GhostStack`.

### In-app explanations: a first-run intro and a «Guida»

Asked for on 2026-09-24. Saldo has ideas a new user does not bring with them — six account types, a period that
starts on a chosen day, what counts towards the totals, budgets as a ceiling per period, goals and pockets, transfers,
a credit card settled from another account, recurring transactions, tags next to categories, hidden mode — and today
nothing in the app explains them. The model is what Apple does when a new app opens: a few cards (icon, title, one
sentence), «Continua», done; and a place to read the same explanations again later.

Three surfaces, one text:

- **First-run intro.** 3–4 cards shown once after onboarding, skippable. Only the ideas that change how the app is
  used from day one.
- **Contextual ⓘ.** Next to what it explains — the account-type tiles, the cycle day, the budget sheet, «Ripeti» —
  opening a sheet. No tooltips over the UI, no coach marks.
- **«Guida» in Profile.** One page per concept; the same entries the ⓘ open.

How it is built:

- The explanations are content, not code: `guide.<concept>.{title,body}` in every catalogue (the parity test
  enforces it). One typed list of concept ids feeds the intro, the ⓘ and the Guida, so they cannot drift apart.
- «Already seen» is a device-local flag, not synced; resetting onboarding or «Elimina tutti i dati» shows the intro
  again.
- Cards and ⓘ are labelled buttons, text follows Dynamic Type, the intro honours Reduce Motion.

- [ ] Analysis before planning:
  - walk every screen and list what a new user must understand to use it, ranked by what a misunderstanding costs;
  - for each concept, decide intro, ⓘ, Guida or none — a hint that compensates for an unclear label is a label to
    fix instead;
  - whether the intro doubles as a «Novità» sheet after an update (Apple uses one pattern for both).
- [ ] Spec section and a mockup in `docs/superpowers/mockups/` (intro cards, ⓘ sheet, Guida list), then the plan.

---

## 0.2 — Forecast: the next three months, from what already repeats

Discussed on 2026-09-21. The ask: a simple forecast of the coming months from past spending. The app already
computes every input it needs, so this is a projection layer on top of §5.5 and §5.7, not a new model.

**What it shows.** In Statistics, the cashflow chart (§5.7) grows **three forecast cycles** after the current
one, drawn dimmed and hatched like the current cycle is today. For each forecast cycle:

- **Expenses** = `median(discretionary of the last 6 cycles)` + Σ recurring expenses that
  `occurrenceDates` places in that cycle. `discretionary = spent − committed`, as in "Quota impegnata".
- **Income** = Σ recurring incomes placed in that cycle + `median(non-recurring counted income of the last 6
  cycles)`.
- **Balance** = the previous cycle's projected balance + income − expenses, starting from today's total balance
  (`monthEndBalances` extended forward). Shown as the net label above each forecast bar pair, and as one line under
  the chart: "A fine {mese} circa {amount}".
- **Uncertainty** = a min/max band from the same 6-cycle window (lowest and highest discretionary), drawn as a
  lighter range behind each forecast expense bar. No statistics beyond what §5.5 already computes.

**Decisions taken with the user (2026-09-21):**

- Scope is spending **and** balance; both share the same inputs, so building one without the other saves nothing.
- Statistics only for now. A Home card ("A fine novembre circa …") and the dashed continuation of the account
  balance line in account detail were considered and left out; add them only if the Statistics version proves
  useful.
- Horizon fixed at **3 cycles**: a median-based forecast degrades fast, and three keeps it credible. No
  3/6/12 selector.
- Band, not a point estimate, so the chart is honest about how noisy six cycles are.

**Rules that carry over unchanged:**

- Forecast is **derived, never stored**: one pure function in `@saldo/core` (`forecastCycles(input, today)`) with
  injected `today`, unit-tested first. Screens only load the ledger and recurrences and render.
- Excluded transactions and transfers stay out, exactly as in every statistic. A recurrence that ends inside the
  horizon contributes only its remaining occurrences.
- Fewer than 3 cycles of history → hide the forecast entirely, same as §5.7 hides the projection line when there is
  no cycle median. Do not fake confidence with one month of data.
- Cycle definition follows the user's period (§5.2), not calendar months, so "next cycle" means whatever the app
  already means by it.
- Money stays integer minor units; medians are rounded once, at the end.

**Considered and not in scope (recorded so they are not re-derived):**

- **Per-category forecast** feeding budget warnings ("Spesa will overflow by ~40 € next month"). Same maths per
  category, but a much heavier UI and much noisier numbers. Revisit after the aggregate version ships.
- **Seasonality** (weighting the same month last year) needs ≥ 12 cycles and most users will not have them for a
  year. Note only.
- **"What if" slider** (add a hypothetical recurring expense, watch the balance move). Good demo, scope creep.
- These aggregates are exactly what the AI insights in 0.5 would consume; whichever ships first should expose
  them from `@saldo/core` in a shape the other can reuse.

**To decide before planning:** nothing — the decisions above are taken.

- [ ] Write the plan (`docs/superpowers/plans/…-forecast.md`) with the core function, the chart extension and
      the i18n keys.

**Done when:** Statistics shows three dimmed forecast cycles with a min/max band and a «A fine {mese} circa
{amount}» line, hidden with fewer than 3 cycles of history, and `forecastCycles` is unit-tested in `@saldo/core`.

---

## 0.3 — Web app (spec §17.1)

D3 says `apps/web` «becomes the web app later»; today `apps/web/app/page.tsx` is fifteen lines. The spec
offered two data paths — query `sync_rows` server-side through `@saldo/core`, or run local-first in the
browser with SQLite WASM and the same sync client — and left the choice to a dedicated spec. **Decided
2026-09-22: server-side.** The browser path would duplicate the phone's engine; the server path builds the
projection that 0.4 and 0.5 need anyway.

**What it builds for everyone after it:** the typed projection. Route handlers (or server components) load a
user's rows from `sync_rows`, validate them against `entitySchemas`, and hand them to the same pure functions
the phone calls — cycle totals, budgets, «Quota impegnata», the forecast of 0.2. No calculation is written
twice; if the web app shows a number the phone does not, one of them is wrong.

**Shape:**

- Same passkey login (the browser ceremony already exists for the phone's sign-in), cookie session.
- DOM components on `@saldo/ui` tokens and `@saldo/i18n`; the mobile screens are the reference, not a
  template — the web app can be read-mostly at first.
- Every query is scoped the way the shared ledger (0.6) will need. Its **shape is decided before this
  milestone starts**, even though it is built last: «two passkeys, one account» means `where user_id = ?`
  stays; «spaces» means every query takes a space id from day one, so 0.6 does not rewrite the web app.

**To decide before planning:**

- [ ] The shared-ledger shape (see 0.6). This is the one decision that cannot wait.
- [ ] Read-only first, or transaction entry from the start.
- [ ] Spec: §17.1 records the server-side decision, the projection gets a section of its own, then the plan.

**Done when:** a user signs in on the web with the phone's passkey and sees Home, transactions and
Statistics matching the phone to the cent, and the projection is the only way server code reads rows.
---

## 0.4 — MCP server: the user's own assistant reads the ledger

Idea from 2026-09-22. The server exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint so
an assistant the user already runs (Claude, or any MCP client) can ask «quanto ho speso in Spesa questo ciclo?»
and get the answer from the user's own instance. It is the mirror image of the AI milestone (0.5): there the
server holds a key and calls a model; here the user's model calls the server, and no key ever touches Saldo.

**What it stands on.** The projection built by 0.3. MCP is its second consumer, not a new model.
Everything money-related is already a pure function in core (cycle totals, budgets, «Quota impegnata», the
forecast of 0.2), so the tools are thin wrappers that load rows, call core and return numbers as integer minor
units plus the currency.

**Shape to aim for:**

- Transport: streamable HTTP on a route in `apps/web` (same process as sync, same Postgres).
- Auth: a **personal access token** minted in Profile, scoped to one user, revocable, shown once. Passkeys
  cannot authenticate an MCP client, so this is a new credential surface and `SECURITY.md` §sessions has to
  describe it.
- Tools, read-only first: list transactions with filters, accounts and balances, budgets with progress, cycle
  aggregates per category, the forecast. Writes (create a transaction, add a tag) come second, and only after the
  read tools have shown the token model holds.
- Everything the tools return is what the app already shows the signed-in user. No aggregate the phone does not
  compute.

**To decide before planning:**

- [ ] Whether this replaces the spending insights half of 0.5 or sits beside it. A user with Claude on the
      desktop gets insights through MCP without giving Saldo a key at all; receipt analysis still needs the
      in-app flow, so 0.5 does not disappear. Answer this before planning 0.5, not before planning this.
- [ ] Token model: one token per client, expiry, and what a revoked token does to an in-flight conversation.
- [ ] Rate limits and the audit trail: a token that reads everything deserves a «last used» column in Profile.
- [ ] Spec section (`§17.4 MCP server`), then the plan.

**Done when:** a user pastes the instance URL and a token into an MCP client and asks about their month, the
answer matches Statistics to the cent, and revoking the token in Profile stops the next call.

---

## 0.5 — AI on the server, bring your own key (spec §17.2, §17.3)

Spec §17.2 stored the provider key in the phone's `expo-secure-store`, never synced, never sent to the Saldo
server; the phone would call the model directly. **Decided 2026-09-22: the key lives on the server.** Saldo is
self-hosted, the server is the user's; one key, one place, every client — phone, web app — uses it without the
user typing it twice. The server calls the provider; the app keeps talking only to its own server, so §18's
«no third-party network calls from the app» stays literally true and gains a sibling line about the server.

**What it stands on.** The projection of 0.3 for aggregates; phase 09b for receipts (capture, compression,
the local file store, the viewer, the category list the prompt needs). The `ReceiptAnalyzer` and
`InsightsProvider` interfaces stay in `@saldo/core/ai` as the spec says; their drivers move server-side, behind
routes the phone calls with its session.

**The thing to settle before building either half:** this is the first time the user's data leaves the
user's machines to a host they do not run. The consent has to be explicit — a screen that says what is sent,
to whom, and when — rather than a settings toggle nobody reads. Worth a spike first: the interface, one
driver, the settings screen. Then the full build.

### Receipt analysis (§17.2)

«Allega foto» → «Analizza scontrino» → the phone uploads the image to its server → the server asks the model
→ a prefilled transaction sheet the user always confirms. Provider: Anthropic or an OpenAI-compatible base
URL, model id configurable.

### Spending insights (§17.3)

Fed **aggregates only** — per-cycle category totals, budgets, trends, the forecast of 0.2 — never raw
descriptions unless the user opts in; results cached per cycle. **Only if 0.4 has not made it redundant**: a
user whose assistant already reads the ledger through MCP may not need Saldo to hold a key for this.

**To decide before planning:**

- [ ] Key **per instance** (the admin sets it in the server environment, everyone uses it, the admin pays)
      or **per user** (each user saves their own in Profile, the server keeps it in Postgres). One household
      needs the first; an instance hosting several does not.
- [ ] Whether insights ship at all, given 0.4.
- [ ] The wording of the §18 change and of the consent screen.
- [ ] The local-only mode (0.1, «A first run with no server») has no AI. Write that down where that
      idea is planned.
- [ ] Spike, then spec update (§17.2, §17.3, §18), then the plan.

**Done when:** a user on an instance with a key scans a receipt into a prefilled sheet, an instance without a
key never contacts a provider, and §18 says exactly what leaves the server and when.
---

## 0.6 — Shared ledger

Saldo exists to replace Spendee's paid features (§1), and shared wallets is one of them. Spec §1.2 excludes
households from the POC; this is the note that it is the next non-goal to fall.

**Built last among the product milestones, decided first.** Its shape fixes how every server-side query is
scoped, so 0.3 and 0.4 need the answer before they start — and once they have it, building the ledger itself
finds the web app and the MCP tools already reading the right rows.

Phase 10b in `docs/superpowers/plans/README.md` is labelled a stopgap, and the proper fix (scoping the
local rows) was put off on 2026-09-12 because *what the rows would be scoped by* is undecided. The two
shapes are already written there and are kept apart on purpose:

- **Two people, one account.** Each registers a passkey on the same user. The server already works this
  way; what is missing is adding a passkey to an existing account — `resolveUser` always mints a new user
  and `addPasskey` wants a session. No local scoping needed. Cheap, and it covers a couple.
- **Two accounts, shared data.** An owning entity (space, household), a membership table, the pull scoped
  to the spaces a user belongs to (`sync_rows` is keyed `(user_id, entity, id)` and the pull is
  `where user_id = ?`), and a rule for rows when somebody leaves. The LWW merge already tolerates more
  writers.

The first shape is a weekend; the second is a phase. They are not exclusive — the first can ship as a
step towards the second, or the second can make the first unnecessary. With no end-to-end encryption (see
below) there is no shared key to distribute, which is the part that made «spaces» hard.

**To decide before planning:**

- [ ] Which shape, or which first. This is the decision that unblocks the proper fix to 10b, and it is due
      **before 0.3 starts**.
- [ ] Trust between members: `SECURITY.md` says today that two people who do not trust each other on one
      server are not served. A shared ledger either keeps that line or has to earn its removal.
- [ ] Spec section (`§5.x Shared ledger`), then the plan.

**Done when:** two phones with two passkeys see the same transactions, budgets and accounts, and the
10b stopgap label comes off.

---

## 0.7 — Public repository

What stands between this repository and its first public push. Audited on 2026-09-18. The repository has
no remote yet, so the first push publishes all 316 commits at once.

**Verified clean and needing nothing:** no `.env`, keystore, `.p12` or personal CSV was ever added in
history; no `sk-`/`ghp_`/`AKIA`/private-key patterns in tracked files; `.env*`, `.vercel`, `.screenshots`
and `transactions_export_*.csv` are ignored; the screenshots in `docs/screenshots/` are demo data with no
real figures; the Spendee fixture is anonymised (`"A Person"`, `"My Money"`); dependency licences hold no
copyleft trap (`node-forge` is dual BSD-3/GPL-2, `@img/sharp-libvips-*` is an LGPL native binary Next pulls
in). The commit author address stays as it is: the repository will be `saliougaye/saldo`, so the name is
public either way.

### Blockers — none of these survive the first push

- [ ] **A security contact.** `SECURITY.md` still says
      `**<!-- SECURITY CONTACT: set this before publishing -->**`, which renders as bold nothing. Put a real
      address there, and turn on GitHub's private vulnerability reporting once the repo exists — the file
      already says that is the better channel.
- [ ] **The repository slug.** `apps/web/app/page.tsx:11`, `docs/building-android.md:107`,
      `docs/building-ios.md:60` and `docs/self-hosting.md:44` name `github.com/saldo-app/saldo`, which does
      not exist; the first is on the landing page every server instance serves. All become `saliougaye/saldo`.
- [ ] **References to a prototype that is not published.** `docs/design/` is gitignored and stays that way,
      but `AGENTS.md:11` sends every implementing agent to `docs/design/README.md` and the line ranges of
      `Spese.dc.html`, `CONTRIBUTING.md:11` links the same README, and source comments cite its line numbers
      (`packages/ui/src/icons.ts:3`, `packages/ui/src/tokens.ts:1`, `packages/i18n/src/locales/it.ts:1`,
      `src/features/stats/CashflowChart.tsx`, `SpendHistoryChart.tsx`, `scripts/generate-demo-data.mjs`). A
      public contributor follows those to a 404. Rewrite each reference to say what the file *was* and that
      it is not part of the repository, without pretending the tokens and icons came from nowhere.

### Worth doing in the same pass

- [ ] **Community health files.** No `CODE_OF_CONDUCT.md`, no `.github/ISSUE_TEMPLATE/`, no
      `PULL_REQUEST_TEMPLATE.md`, no `dependabot.yml`. `CONTRIBUTING.md` tells people to open an issue
      describing the behaviour before sending a fix, and gives them no template to shape it.
- [ ] **Decide what happens to `.claude/`, `.agents/` and `skills-lock.json`.** All three are untracked
      *and* un-ignored, so a `git add .` before the first push commits them. Either ignore them or commit
      them on purpose.
- [ ] **Local paths and a first name in tracked files.** `/Users/saliougaye/…` and `rtk proxy` (a private
      local wrapper) appear in `docs/superpowers/plans/2026-09-13-11-release-and-hardening.md:978,1076,1250`
      and `2026-09-19-more-colors-icons.md`, and `apps/web/src/server/auth/admin.test.ts:88` uses `'Saliou'`
      as a display name. Cosmetic, but the paths read as an accident rather than a choice.
- [ ] **A dependency gate in CI.** `.github/workflows/ci.yml` runs lint, typecheck and test only. A public
      repo gets Dependabot, CodeQL and secret-scanning push protection for free; `pnpm audit` is one more
      step.
- [ ] **The phase index understates what works.** The passkey ceremony was run on a real phone on
      2026-09-18 and it works. Six phases still end with a sentence saying it has never been driven — 06,
      06b, 07, 08, 10 and 11 in `docs/superpowers/plans/README.md`, and with it the `SALDO_SCHEME` round
      trip, the invite burn in `afterVerification`, the first-account-becomes-admin rule and the connected
      state of §6.30. That index is the first thing a visitor reads, so correct it before the repository is
      public: record what was actually exercised on the device, and leave the rest listed as still open.

**Done when:** the repository is public at `github.com/saliougaye/saldo`, private vulnerability reporting
is on, and a stranger can follow every link in `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and
`AGENTS.md` without hitting a 404 or a private path.

---

## 0.8 — Releases & distribution

Self-hosting currently means building the server from source, and installing the app means owning a Mac
or an Android SDK. `.github/workflows/ci.yml` is the only workflow: nothing is published anywhere. Found
on 2026-09-18 while asking what an open-source self-hoster sees.

### Releases first: there is nothing to update *to*

`git tag` returns nothing, there is no `CHANGELOG`, and `apps/web/src/server/version.ts:5` hard-codes
`APP_VERSION = '0.1.0'`, so `/api/health` and the landing page report the same version whatever commit is
running. `docs/self-hosting.md` §Updating explains the order (server first, then the phones) but the only
thing to update to is `main`, and a `SYNC_SCHEMA_VERSION` bump with no release note is discovered as a
`409` on the phone. The image and the fork workflow below need a tag to hang on anyway, so this comes
first:

- [ ] Semver tags (`v0.1.0` …) and a `CHANGELOG.md` whose entries say in the first line whether
      `SYNC_SCHEMA_VERSION` or `apiVersion` moved — that line is what a self-hoster reads before pulling.
- [ ] `APP_VERSION` derived from the tag at build time (the file's own comment says why it cannot read
      `package.json` at runtime; a build-time inject keeps that property).

### Then distribution

`SALDO_SERVER_URL` is baked in at build time (08b), so **one official APK cannot exist** — but two things
can:

- [ ] A tagged server image on `ghcr.io`, so `docker compose` pulls instead of building. Tagged with the
      same version as the release, and `latest` only on a tagged build.
- [ ] A reusable workflow a user runs in their own fork, with their own `SALDO_SERVER_URL` and signing
      secrets, producing a signed APK as an artifact. It pins itself to a tag too, so the APK a user builds
      says which release it is.

The second one needs care in the writing: keystore-in-secrets guidance, and a hard rule that this
repository never publishes an APK of its own, because any APK it built would point at the wrong server.

**Done when:** `docs/self-hosting.md` quick start pulls an image instead of cloning, `/api/health` reports
the tag it was built from, and a fork owner gets a signed APK without a Mac.

---

## Considered and not planned

Kept so they are not re-derived.

- **End-to-end encryption.** The server was nearly a blob store — `packages/core/src/sync/protocol.ts:27`
  carries `data: z.unknown()`, D11 stores it opaquely — and only `apps/web/src/server/sync/push.ts:16`
  (schema validation), attachment bytes in clear and a visible `deletedAt` stood in the way. Dropped on
  2026-09-22 because 0.3, 0.4 and 0.5 all need the server to read rows: a server-rendered web app, an MCP
  endpoint and a server-held AI key cannot work on ciphertext. Key handling was the other reason: the passkey
  PRF extension is out of reach through the browser ceremony, so it would have been a separate key the user
  must keep, with the recovery story that implies. The trust model stays the one `SECURITY.md` states: you
  trust your own server.
- **Web app local-first in the browser (SQLite WASM).** The other half of §17.1's choice. Dropped with the
  server-side decision of 0.3; it would duplicate the phone's engine and give the server nothing to project
  for 0.4 and 0.5.
- **Provider key on the phone (§17.2 as written).** Replaced by the server-side key in 0.5 on 2026-09-22.
  Safer against a compromised server, but the self-hoster owns the server, and a key per device means typing
  it on every phone and again in the web app.
