# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — going
public, releases, shared ledger, AI, web app — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Bugs

Something that works wrong today.

None open.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### Hidden mode: hide the figures in public

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

### Forecast: the next three months, from what already repeats

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

### Onboarding: a better UI, and a step for the system permissions

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

### Goals: saving towards a target

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

### Five more languages: French, German, Swedish, Spanish, Portuguese

- [ ] Asked for on 2026-09-21. Scope the catalogs and the formatting tables, then plan.

Today the app speaks `it` and `en` only (`SUPPORTED_LOCALES` in
`packages/i18n/src/format.ts:13`). A language is more than a catalog:

- **The catalog.** `packages/i18n/src/locales/{fr,de,sv,es,pt}.ts`, ~760 keys each, registered in `resources`
  (`packages/i18n/src/index.ts`). The parity test (`locales.test.ts`) only compares `it` against `en`; it has to
  check every catalog against `it`, keys and `{{variables}}` both.
- **The formatting tables.** `format.ts` hand-writes, per locale, the separators, short and long months and short and
  long weekdays (`Record<AppLocale, …>`, no `Intl`). Each new locale fills all five, and the separators differ:
  `de`/`es`/`pt` `.` and `,`, `fr` and `sv` a (narrow) no-break space and `,`. Pin them with `format.test.ts` cases.
- **The setting.** `language` is `z.enum(['system', 'it', 'en'])` in `packages/core/src/entities.ts:50`, a synced
  field, plus the column type in `apps/mobile/src/db/schema.ts:33` and `seed.ts`. Widening the enum means an older
  build rejects a settings row written by a newer one — acceptable before release (see the frozen
  `SYNC_SCHEMA_VERSION`), worth a line in the changelog after. `resolveLocale` must map `pt-BR`/`pt-PT`, `es-*`
  etc. to the base language.
- **The Language screen** (`app/profile/language.tsx`) grows from three rows to seven; each language named in its
  own tongue, not translated.
- **Quality.** Machine-drafted text is fine for a start, but the Italian copy is written with care (tone, short
  labels that fit the design). Each catalog needs a native read before it ships, and German will overflow some
  buttons and chips — check the longest strings on the simulator.

Open point: `pt` as one catalog, or `pt-PT` and `pt-BR` separately (they differ in vocabulary more than in grammar).
Suggested: one `pt` (European) for now.

## Ideas

Directions worth keeping, not yet asked for as work. Most reopen a product decision.

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

### A mascotte in 3D — scope undecided

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

### Considered on 2026-09-18 and not planned

Kept so they are not re-derived.

- **Settling an account ("Controlla il saldo").** Analysed in
  `docs/superpowers/analysis/2026-09-17-settle-an-account.md` (a balance checkpoint after an import). Dropped on
  2026-09-21: onboarding's import path already asks each imported account's current balance (§6.29), and the
  account sheet's balance field covers a balance that drifts later.
- **Field-level merge.** `packages/core/src/sync/merge.ts` is whole-row last-writer-wins; the settle analysis
  shows the cost (a rename on one phone can undo a balance edit on another). Rare in practice — rename against
  colour, one settings toggle against another. Not worth the machinery.
- **Native passkeys (§9.4).** D13 still holds: a free Apple ID cannot sign Associated Domains, and the app is
  sideloaded. Pointless until there is a store build.
- **Multi-currency.** §1.2 excludes it with a reason (historical rates per transaction date). A decision, not a gap.
