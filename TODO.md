# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list.

## Settle an account (analysis first)

Analysis in `docs/superpowers/analysis/2026-09-17-settle-an-account.md`; a balance checkpoint (C) was chosen
over keeping the opening-balance edit (A) with the user on 2026-09-18.

- [ ] Answer the open questions below, then plan it.

Use case: the history comes from a Spendee export, but the bank says the account holds a different
amount. The import creates unknown accounts with `openingBalance 0` (§11.3), so afterwards the
balance is only the sum of the imported rows.

Editing the balance in the account sheet already stores `openingBalance = entered − Σ(transaction
effects)` (§6.22), which shifts every past balance by the difference. Compare it with an adjustment
transaction dated today, visible in the list, before building anything:

- which one keeps statistics and budgets honest — an adjustment must not count as spending or income;
- how it syncs, and what happens when two devices settle the same account;
- whether it should be offered straight after an import. Onboarding's import path already asks each imported
  account's current balance and stores it as an opening balance (§6.29), so this is about an import from
  Profile, or a balance that drifts later.

### Proposal: "Controlla il saldo" (not agreed yet)

A checkpoint says "on this date the bank said X", so imported rows dated on or before an account's latest
checkpoint do not move today's balance. Only these accounts need checking after an import from Profile:

- accounts the import **created** (they start at 0, with no checkpoint);
- existing accounts with **no checkpoint**;
- existing accounts that received imported rows dated **after** their latest checkpoint.

The app can work that out itself, so the step lists only accounts whose figure may be wrong.

1. **Where:** in the import's done state, under "Importate N · Saltate M", a "Controlla il saldo" card with one row
   per account to check (name + computed balance). Tapping a row opens a small sheet with the balance field (with
   the `±` switch); saving writes a checkpoint for today. Not blocking: "Vedi le transazioni" stays, the step can be
   skipped, and checked rows get a tick.
2. **The field starts at the computed balance.** Saving it unchanged still writes a checkpoint — the user is
   confirming the figure. Skipping writes nothing.
3. **Checkpoint date: today.** The bank figure is today's even when the file ends last week; what happened between
   the end of the file and today is the user's to add, and the checkpoint does not hide it.
4. **Onboarding uses the same thing.** Import step 4 writes a checkpoint for today instead of changing the opening
   balance, so there is one way to set a verified balance and the account detail shows "Saldo verificato il …" from
   day one.

Open questions:

- **A. The account sheet's balance field.** Does typing a balance there create a checkpoint for today? Suggested:
  yes — one mental model, and the sync hole goes away for every balance edit, not only after an import.
- **B. Past dates.** "The statement on 31 August said X": allowed? Suggested: yes from the account detail (a date
  picker in the sheet, nothing changes in the maths), but "Controlla il saldo" stays fixed to today.
- **C. Scope of the list.** Only the three cases above, or every account the import touched? Suggested: the three
  cases.
- **D. Elsewhere.** A "not checked since…" hint on accounts without a checkpoint, on Home or Accounts? Suggested:
  not now.

## CSV import ignores `excluded`

- [ ] Read the `excluded` column the Saldo CSV export writes (§11.2) when importing (§11.3).

A Saldo CSV round trip counts excluded rows again: `IMPORT_FIELDS` has no `excluded`, so every imported row gets
`excludeFromTotals: false`. Found during the settle analysis.

## Tags: freeze and layout

Reported on 2026-09-19. Not investigated yet.

- [ ] **The app sometimes freezes** when deleting a tag, or while picking an icon for it. Reproduce first: find out
      whether the freeze is the icon grid rendering (too many items in one pass) or the delete flow (a confirm sheet
      over the edit sheet).
- [ ] **Tag edit UI:** move the edit and delete actions to the top of the sheet instead of the bottom.

## Going public: what is missing before the first push

Audited on 2026-09-18. The repository has no remote yet, so the first push publishes all 316 commits at once.
**Verified clean and needing nothing:** no `.env`, keystore, `.p12` or personal CSV was ever added in history; no
`sk-`/`ghp_`/`AKIA`/private-key patterns in tracked files; `.env*`, `.vercel`, `.screenshots` and
`transactions_export_*.csv` are ignored; the screenshots in `docs/screenshots/` are demo data with no real figures;
the Spendee fixture is anonymised (`"A Person"`, `"My Money"`); dependency licences hold no copyleft trap
(`node-forge` is dual BSD-3/GPL-2, `@img/sharp-libvips-*` is an LGPL native binary Next pulls in). The commit
author address stays as it is: the repository will be `saliougaye/saldo`, so the name is public either way.

Blockers — none of these should survive the first push:

- [ ] **A security contact.** `SECURITY.md` still says `**<!-- SECURITY CONTACT: set this before publishing -->**`,
      which renders as bold nothing. Put a real address there, and turn on GitHub's private vulnerability reporting
      once the repo exists — the file already says that is the better channel.
- [ ] **The repository slug.** `apps/web/app/page.tsx:11`, `docs/building-android.md:107`,
      `docs/building-ios.md:60` and `docs/self-hosting.md:44` name `github.com/saldo-app/saldo`, which does not
      exist; the first is on the landing page every server instance serves. All become `saliougaye/saldo`.
- [ ] **References to a prototype that is not published.** `docs/design/` is gitignored and stays that way, but
      `AGENTS.md:11` sends every implementing agent to `docs/design/README.md` and the line ranges of
      `Spese.dc.html`, `CONTRIBUTING.md:11` links the same README, and source comments cite its line numbers
      (`packages/ui/src/icons.ts:3`, `packages/ui/src/tokens.ts:1`, `packages/i18n/src/locales/it.ts:1`,
      `src/features/stats/CashflowChart.tsx`, `SpendHistoryChart.tsx`, `scripts/generate-demo-data.mjs`). A public
      contributor follows those to a 404. Rewrite each reference to say what the file *was* and that it is not
      part of the repository, without pretending the tokens and icons came from nowhere.

Worth doing in the same pass:

- [ ] **Community health files.** No `CODE_OF_CONDUCT.md`, no `.github/ISSUE_TEMPLATE/`, no
      `PULL_REQUEST_TEMPLATE.md`, no `dependabot.yml`. `CONTRIBUTING.md` tells people to open an issue describing
      the behaviour before sending a fix, and gives them no template to shape it.
- [ ] **Decide what happens to `.claude/`, `.agents/` and `skills-lock.json`.** All three are untracked *and*
      un-ignored, so a `git add .` before the first push commits them. Either ignore them or commit them on purpose.
- [ ] **Local paths and a first name in tracked files.** `/Users/saliougaye/…` and `rtk proxy` (a private local
      wrapper) appear in `docs/superpowers/plans/2026-09-13-11-release-and-hardening.md:978,1076,1250` and
      `2026-09-19-more-colors-icons.md`, and
      `apps/web/src/server/auth/admin.test.ts:88` uses `'Saliou'` as a display name. Cosmetic, but the paths read
      as an accident rather than a choice.
- [ ] **A dependency gate in CI.** `.github/workflows/ci.yml` runs lint, typecheck and test only. A public repo
      gets Dependabot, CodeQL and secret-scanning push protection for free; `pnpm audit` is one more step.

## The roadmap understates what works

The passkey ceremony was run on a real phone on 2026-09-18 and it works. Six phases still end with a sentence
saying it has never been driven — 06, 06b, 07, 08, 10 and 11 in `docs/superpowers/plans/README.md`, and with it
the `SALDO_SCHEME` round trip, the invite burn in `afterVerification`, the first-account-becomes-admin rule and
the connected state of §6.30. The roadmap is the first thing a visitor reads, so this is worth correcting before
the repository is public. Record what was actually exercised on the device, and leave the rest listed as still
open.

## Distribution: a server image, and an app build that does not need a Mac

Self-hosting currently means building the server from source, and installing the app means owning a Mac or an
Android SDK. `.github/workflows/ci.yml` is the only workflow: nothing is published anywhere.

`SALDO_SERVER_URL` is baked in at build time (08b), so **one official APK cannot exist** — but two things can:

- a tagged server image on `ghcr.io`, so `docker compose` pulls instead of building;
- a reusable workflow a user runs in their own fork, with their own `SALDO_SERVER_URL` and signing secrets,
  producing a signed APK as an artifact.

The second one needs care in the writing: keystore-in-secrets guidance, and a hard rule that this repository never
publishes an APK of its own, because any APK it built would point at the wrong server.

### Releases: there is nothing to update *to*

Found on 2026-09-18 while asking what an open-source self-hoster sees. `git tag` returns nothing, there is no
`CHANGELOG`, and `apps/web/src/server/version.ts:5` hard-codes `APP_VERSION = '0.1.0'`, so `/api/health` and the
landing page report the same version whatever commit is running. `docs/self-hosting.md` §Updating explains the
order (server first, then the phones) but the only thing to update to is `main`, and a `SYNC_SCHEMA_VERSION` bump
with no release note is discovered as a `409` on the phone. The image and the fork workflow above need a tag to hang
on anyway, so this comes first:

- [ ] Semver tags (`v0.1.0` …) and a `CHANGELOG.md` whose entries say in the first line whether
      `SYNC_SCHEMA_VERSION` or `apiVersion` moved — that line is what a self-hoster reads before pulling.
- [ ] `APP_VERSION` derived from the tag at build time (the file's own comment says why it cannot read
      `package.json` at runtime; a build-time inject keeps that property).
- [ ] The `ghcr.io` image tagged with the same version, and `latest` only on a tagged build.
- [ ] The fork workflow pins itself to a tag too, so the APK a user builds says which release it is.

## A first run with no server (local-only), sign-in later

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

## A shared ledger — decide the owning entity

Phase 10b in `docs/superpowers/plans/README.md` is labelled a stopgap, and the proper fix (scoping the local rows)
was put off on 2026-09-12 because *what the rows would be scoped by* is undecided. The two shapes are already
written there and are kept apart on purpose:

- **Two people, one account.** Each registers a passkey on the same user. The server already works this way; what
  is missing is adding a passkey to an existing account — `resolveUser` always mints a new user and `addPasskey`
  wants a session. No local scoping needed. Cheap, and it covers a couple.
- **Two accounts, shared data.** An owning entity (space, household), a membership table, the pull scoped to the
  spaces a user belongs to (`sync_rows` is keyed `(user_id, entity, id)` and the pull is `where user_id = ?`), and a
  rule for rows when somebody leaves. The LWW merge already tolerates more writers.

Saldo exists to replace Spendee's paid features (§1), and shared wallets is one of them. Spec §1.2 excludes
households from the POC; this is the note that it is the next non-goal to fall, and that the first shape is a
weekend while the second is a phase.

## Web app (spec §17.1) and end-to-end encryption — decide together

Two futures that constrain each other, recorded so the first one built does not close the second by accident.

**Web app.** D3 says `apps/web` «becomes the web app later»; today `apps/web/app/page.tsx` is fifteen lines. The
spec offers two data paths and decides neither: query `sync_rows` server-side through `@saldo/core` (D11 foresees a
«typed projection»), or run local-first in the browser with SQLite WASM and the same sync client. The second reuses
what the phone already has; the first makes the server read the data.

**End-to-end encryption.** The server is already nearly a blob store: `packages/core/src/sync/protocol.ts:27` carries
`data: z.unknown()`, D11 stores it opaquely, and no route has relational logic. What stands in the way is small but
real: `apps/web/src/server/sync/push.ts:16` validates every row against `entitySchemas` (the server reads the
content), attachment bytes sit on the server in clear, and `deletedAt` stays visible in the envelope. Key
handling is the hard part — the passkey PRF extension is out of reach through the browser ceremony and one-time
token handoff, so it would be a separate key the user has to keep, with the recovery story that implies.

The constraint: a server-side web app needs to read rows; encrypted rows cannot be read. Pick one before either is
built. Neither is next.

## Hidden mode: hide the figures in public

The idea: a gesture or a toggle hides every amount while the app keeps working — balances, transaction
amounts, budget figures, charts — and a tap brings them back. It is for using the app on a train, not a
second lock.

What it can stand on:

- `AmountText`/`AnimatedAmount` (`apps/mobile/src/components/AmountText.tsx`) is the single place money reaches
  a screen. Masking there covers most of the app in one change.
- Not all of it: 22 files still call `formatMoney` directly, and the charts draw magnitudes rather than text
  (`src/features/stats/CashflowChart.tsx`, `SpendHistoryChart.tsx`, `SplitBar.tsx`, the budget progress bars).
  A bar chart with the axis labels hidden still shows the shape of the month. The audit is the work; the
  component change is small.
- The privacy machinery already exists and this is a sibling of it, not a variant: §6.32's `PrivacyOverlay`
  blanks the app in the switcher, and `appLockEnabled` in `kv` (`src/db/kv.ts`) is the pattern for a
  device-local flag. The hidden-mode flag belongs in `kv` too — per device, never synced; a phone hidden in
  public must not blank the tablet at home.

To settle before planning:

- **The trigger.** A row in Profile is discoverable but slow; a gesture (long-press on the home balance, a
  two-finger tap) is fast but invisible. Probably both — the row declares the feature exists, the gesture is
  what gets used. `react-native-gesture-handler` is already a dependency; `expo-haptics` is not.
- **Whether it survives a relaunch.** Persisting protects; resetting to visible is what people expect. Spec is
  silent, and the design prototype has no precedent for either.
- **What a hidden figure looks like.** `expo-blur` over the number reads as "a number is here" but is a new
  dependency and blurs differently on Android; `••••` at the same tabular width has no layout shift and no
  dependency. The second is cheaper and probably right.
- **Inputs stay visible.** Hiding the amount being typed in `AmountInput` is hostile. Hiding the list behind
  the form is the point.
- **Accessibility.** A hidden amount must drop out of the accessibility tree as well, otherwise VoiceOver
  reads out loud exactly what the screen is hiding.

## Considered on 2026-09-18 and not planned

Kept so they are not re-derived.

- **Field-level merge.** `packages/core/src/sync/merge.ts` is whole-row last-writer-wins; the settle analysis
  shows the cost (a rename on one phone can undo a balance edit on another). The checkpoint above removes the
  frequent case; what is left — rename against colour, one settings toggle against another — is rare. Not worth
  the machinery.
- **Native passkeys (§9.4).** D13 still holds: a free Apple ID cannot sign Associated Domains, and the app is
  sideloaded. Pointless until there is a store build.
- **Multi-currency.** §1.2 excludes it with a reason (historical rates per transaction date). A decision, not a gap.

## AI receipt analysis, BYOK (spec §17.2)

Spec §17.2 already fixes the shape: provider (Anthropic or an OpenAI-compatible base URL), the key in
`expo-secure-store` and never synced, a `ReceiptAnalyzer` in `@saldo/core/ai`, and "Allega foto" → "Analizza
scontrino" → a prefilled transaction sheet the user always confirms. Phase 09b already shipped everything it
stands on: capture, compression, the local file store, the viewer, and the category list the prompt needs.

The thing to settle before building: this is the first outbound call to a host the user does not run, and §18
currently promises no third-party network calls at all. That line changes with the feature, and the consent has
to be explicit rather than a settings toggle nobody reads. Worth a spike first — the interface, one driver, and
the settings screen — rather than a full build.

## AI spending insights, BYOK (spec §17.3)

The second half of §17: an `InsightsProvider` in `@saldo/core/ai`, fed **aggregates only** — per-cycle category
totals, budgets and trends out of `@saldo/core` — never raw descriptions unless the user opts in, with results
cached locally per cycle. It shares the provider settings, the key storage and the consent question with the
receipt analyser above, so whichever is built first should build those for both.

## Forecast: the next three months, from what already repeats

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
- These aggregates are exactly what §17.3 AI insights would consume; whichever ships first should expose them from
  `@saldo/core` in a shape the other can reuse.

- [ ] Write the plan (`docs/superpowers/plans/…-forecast.md`) with the core function, the chart extension and
      the i18n keys, then move this item out of the list.

## A mascotte in 3D — scope undecided

The idea is a 3D character, possibly a panda. The brand today is a raccoon: `docs/brand/mascotte/procione*.svg`
plus thirteen generator pages that render nine outputs (iOS light, dark and tinted; Android background, foreground
and monochrome; splash light and dark; favicon).

Two constraints to decide against, recorded so they are not re-derived:

- **Android monochrome and iOS tinted flatten to a single-channel silhouette.** Shading does not survive them, so
  those variants stay vector whatever the hero art becomes.
- **The current pipeline is HTML/CSS/SVG → PNG.** A 3D render needs a renderer alongside it, and 3D sits against
  an interface drawn in flat 1.5px strokes.

The cheap shape is therefore: keep the vector set for icons and splashes, and use 3D only where shading survives —
README, docs, a future landing page. Whether the character stays a raccoon or becomes a panda is a free choice
either way. The empty states (§13) already have a mascot variant waiting: variant D of their design review, the
raccoon peeking over the ghost stack, would replace `GhostStack` alone.

## Onboarding: a better UI, and a step for the system permissions

- [ ] Rework the onboarding screens (§6.29). Today they follow the prototype's step layout (1616–1717) and have not
      had a design pass since; scope the redesign before planning it.
- [ ] Add a step that asks for the system permissions up front, each one with a sentence saying what it is for and
      a "Più tardi" that skips it. Today every permission is asked at the moment it is first needed:
  - **notifications** — budget alerts (§5.8), requested by `src/features/budgets/BudgetAlertsGate.tsx`;
  - **camera and photos** — attachments, requested by `src/attachments/capture.ts`;
  - **Face ID / biometrics** — the app lock (`app/lock.tsx`); this one is an opt-in setting, so the step offers to
    turn the lock on rather than asking for a permission.

  Open points: whether the step sits on both paths (*Da zero* and the import) or only after "Inizia"; that a denied
  permission cannot be asked again by iOS, so the step must not burn the one prompt the in-context request relies on
  (show our own explanation first, call the system prompt only on "Attiva"); and that Profile needs a place to see
  and change each one afterwards (a denied one links to the system settings).

## Goals: saving towards a target

Example: putting money aside to buy a car — «Macchina, 12.000 € entro giugno 2027».

Budgets cannot do this, and bending them would break them: a budget is a **ceiling on spending** — `spent` is the sum
of counted expenses in a category (§5.8), the bar fills as money goes *out*, and rollover only carries the unspent part
of a limit. A goal is the opposite shape: a **target to accumulate**, with a deadline, filled by money put aside.

What exists today is half of it: a `savings` account (§3, excluded from Totale spendibile) plus transfers into it
already model "money set aside"; what is missing is the target, the deadline and the progress.

- [ ] Decide the model before planning:
  - a goal **linked to an account** (progress = the account's balance, or its growth since the goal started), or
    a goal with its **own contributions** (so one account can hold several goals);
  - the "on track" rule: required per period = (target − saved) / periods left, against the pace of the budget bars;
  - where it lives: a Home card like budgets, a row in Profile, or on the account detail;
  - reaching the target, missing the deadline, and what happens to the money when the goal is closed.
- [ ] Spec section (`§5.x Goals`), then the plan.
