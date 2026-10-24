# Roadmap

Where Saldo goes after the proof of concept, in the order the work has to happen. Each milestone is a
coherent release a self-hoster can update to. Milestone numbers are names, not version numbers and, since
2026-10-19, not an order either: the diagram below gives the order, and the sections follow it. Going public
and the marketing site come right after the MCP server; releases and the stores follow them; AI and shared finances come last.

This file holds the big directions. Small features that fit in one plan live in
[`TODO.md`](TODO.md); the POC phases that are already built, with their plans and acceptance criteria, live
in [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md). When a milestone is picked up
it gets a spec section and a plan under `docs/superpowers/plans/` like any other piece of work, and this
file records what was decided.

Every milestone keeps the rules that make Saldo what it is: local-first on the phone, integer money,
business rules in `@saldo/core` with tests first, no third-party call the user did not ask for. Where a
milestone bends one of them, the bend is written down here before it is built.

## The order, and what actually constrains it

```
0.1 Everyday features ──> 0.2 Forecast ──> 0.3 Web app ──> 0.4 MCP server ──> 0.7 Public ──> 0.8 Marketing site ──> 0.9 Releases & stores ──> 0.5 AI on the server ──> 0.6 Shared finances
```

Only three things in this order are dependencies; everything else is preference and can move.

| Before | After | Why |
|---|---|---|
| Forecast (0.2) | AI insights (0.5), the MCP forecast tool (0.4) | they consume its aggregates |
| Whichever of web app, MCP, AI comes first | the other two | it builds the server-side projection they all read |
| Public (0.7) | Marketing site (0.8) → Releases (0.9) | the site links to the public repository, and is live before a release is announced (decided 2026-09-26) |

**Moved on 2026-10-19:** Public (0.7) and the marketing site (0.8) now come before AI (0.5) and shared finances
(0.6). The 2026-09-22 decision put everything before going public, and the 2026-09-26 one put shared finances
before it. Both give way to getting the project seen sooner. The cost is small: the repository goes public
before the `sync_rows` key changes, so the README must say that `main` is pre-release and that no migration is
promised until 0.9 (a checklist item in 0.7).

**Moved on 2026-10-24:** Releases and the stores (0.9) now come before AI (0.5) and shared finances (0.6). The
decisions of 2026-09-22 and 2026-09-26 put the release last, so that no real data would exist when shared finances
changed the key of `sync_rows`. They give way to getting the app into the hands of people sooner. The cost is real
this time: from the first store release, people hold production rows. Shared finances (0.6) must then ship a
**forward migration** of `sync_rows` and of the phone's local rows, not a reset. 0.6 says so in its own section.

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
- [x] Plan B: pockets and goals, reusing the target card (B1 rules and data, B2 screens; device check pending).

### Period recap: close the last period before the next one starts

Asked for on 2026-09-22. On the first day of a new period — the day after the old one ended — the app shows a recap
of the period that just closed, and only then the Home of the new one. Today the switch is silent: at midnight the
Home, the budgets and the stats move to the new period and the closed one is only reachable by paging back.

"Period" is whichever the user picked (§5.2: month, week, pay cycle, year), not only the pay cycle; the recap follows it.

What the recap shows, all of it already computable from what exists:

- income, expenses and the net, against the previous period and the 6-period median (`stats.ts`, `previousPeriods`);
- the top categories, and the one that moved the most against its average;
- budgets: which stayed within the limit, which went over, and what rolls over into the new period
  (`rollover.ts`);
- the biggest single expense, and the net-worth change over the period.

How it behaves:

- **When.** On the first open on or after the first day of the new period, once per period (remember the last
  period recapped device-locally, like the budget alerts' `lastAlertPeriodStart`). A local notification at 09:00
  that day ("Il tuo {periodo} si è chiuso: guarda il riepilogo") reuses the §5.8 permission.
- **Where.** A full-screen sheet over the Home, dismissed with one button ("Inizia il nuovo {periodo}"), and not
  reachable again afterwards.
- **Computed, never stored.** A transaction entered late for the old period changes the recap, as it changes the
  stats. One pure function in `@saldo/core` (`periodRecap(def, range, txs, budgets, …)`), TDD, and the screen only
  renders it.

- [x] Decide before planning (2026-09-25, spec D27, §5.15, §6.39):
  - **A sheet for every kind, the week included**, on the first open of the new period; a 09:00 notification that
    day, always (making it optional is a later setting).
  - **Seen once.** No Home card and no entry in the period history: once dismissed it cannot be reopened.
  - **Layout «Resoconto»**: one card with the net, the comparisons and income/expenses, then Categorie, Budget and
    Altro, all open. The «usual» comparison is the §5.5 median, not an average.
  - **Not shareable** as an image.
- [x] Spec section (§5.15 Period recap, §6.39) and a design pass (mockup in `.variants/period-recap.html`, not
  committed).
- [x] Plan (`docs/superpowers/plans/2026-09-25-period-recap.md`) and build; checked on a phone (Expo Go).

Later ideas, not planned: reopening past recaps (it has to survive changes of period kind), a setting to turn the
notification off, sharing a recap as an image.

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

- [x] Decide the UI (2026-09-25, variants harness, «Due passi»): two equal doors on the welcome; the server door is
  one screen whose address field swaps into a server row, then the passkey. Failures reuse the row with a hollow
  grey ring and words, no red.
- [x] Decide the address: **typed**, Immich-style, and `SALDO_SERVER_URL` removed rather than kept as a prefill —
  which reverses 08b. «Esci» now leaves a working local-only app.
- [x] Spec (§1.1, §1.2, §6.29 step 0, §6.30, §9.3 steps 1 and 8, §15, §18) and plan
  `docs/superpowers/plans/2026-09-25-local-first.md`; checked on the iOS simulator.

### Mascot states

Moved here from `TODO.md` on 2026-09-22. The mark is Rocky, the raccoon generated in
github.com/saliougaye/mascots; the app icons, splash and favicon in `apps/mobile/assets/` are copies of its
`out/saldo/icons/`, the two poses in `apps/mobile/assets/mascot/` are its `stills/idle.svg` and `stills/success.svg`
rendered at 480 px.

The kit also carries Lottie state animations (idle, empty, loading, thinking, error, success, wave, sleep).

- [x] Where Rocky appears (2026-09-24, spec D26, §13 *Mascot*, plan `docs/superpowers/plans/2026-09-24-mascot-states.md`):
  peeking over the «nothing yet» ghost stack, over a reached goal's card, and whole in its close sheet. Static PNGs,
  no Lottie.
- [x] Rocky redrawn as a flat vector character in the style of SmoothPressure's Capy (2026-09-25, mascots PR #4),
  replacing the 3D clay render: new icons, splash, favicon and poses; the `mascot` token re-measured on the new PNGs.
- [x] Rocky as the kit's Lottie states, and in four more places (decided 2026-09-25, D26 widened, §13 *Mascot*):
  waving on the welcome, asleep on the lock screen, waiting in a long labelled load, small above a failed import or
  restore. Plan `docs/superpowers/plans/2026-09-25-mascot-lottie.md`; checked on the iOS simulator.

### In-app explanations: a first-run intro and a «Guida» ✅ done

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

- [x] Analysis before planning (2026-09-26, spec D28, §5.16):
  - eleven concepts, ranked by what a misunderstanding costs. **Intro**: the period, «Rimasto da spendere» (income −
    spent, not a bank balance), transfers (a card payment included), recurring. **ⓘ**: account types, the credit
    card's «Addebitata su», the period kind and cycle day, budgets, «Ripeti», a goal's «Dove li tieni». **Guida only**:
    tags, hidden mode, where the data lives — the screens already say them in a sentence;
  - labels fixed instead of explained: «ciclo» where the period in general is meant, «Includi nel saldo disponibile»
    → «Includi nel totale spendibile»;
  - **no «Novità» yet**: there are no releases to compare. The intro takes a list of ids, so a «Novità» after an
    update reuses it once 0.9 exists.
- [x] Spec (D28, §5.16, §6.40–§6.42) and a mockup (`docs/superpowers/mockups/2026-09-26-guide-variants.html`: intro
  on one screen, ⓘ as a sheet with the whole text, Guida as grouped rows with the summary — variants 1A, 2A, 3A).
- [x] Plan (`docs/superpowers/plans/2026-09-26-in-app-guide.md`) and build; checked on the iOS simulator.

### Transfers: a button to fill the amount with the source's whole balance ✅ done

Asked for on 2026-09-24. Moving everything out of an account — emptying a pocket, sweeping a checking account into
savings — means reading the source's balance and retyping it on the keypad, cents included. A button on the transfer
sheet (§6.16) fills the amount with the source's total in one tap; the user can still edit it, and nothing is written
until they save.

- **Where.** The new/edit transaction sheet, kind Trasferimento, under the amount figure. It follows the **Da**
  picker: change the source and the button reads that account's balance. The goal's «Accantona» (§6.36) opens the
  same sheet prefilled as a transfer from the parent, so it gets the button too: «put aside everything the parent
  holds». It is the parent's whole balance, not what the goal still lacks.
- **Which total.** The source's balance today (§5.3), the same number its detail shows. For a credit card, the
  amount the card owes — the «Tutto il saldo» choice that «Salda carta» already offers (§6.16) — so the two do not
  disagree.
- **Not offered** when the source's balance is 0 or negative: there is nothing to move.
- **Pure function in `@saldo/core`**, TDD first, that returns the amount to prefill for a source and a `today`; the
  sheet only calls it. Money stays integer minor units.

- [x] Decide before planning (2026-09-25): a **chip** «Tutto il saldo · {amount}» under the figure; «Accantona»
      (any transfer into an open goal) also gets «Quanto manca · {amount}», capped at the source's balance and shown
      only when smaller; «Preleva» gets the chip from its Da picker, «Riporta in {parent}» keeps its own prefill; a
      credit card as source offers only a credit (the > 0 rule), and **towards** a card there is no chip, since
      paying a card the figure is its debt, which «Salda carta» offers under the same label.
- [x] Spec line in §6.16 and the plan (`docs/superpowers/plans/2026-09-25-transfer-fill-balance.md`);
      `transferFillAmounts` in `@saldo/core`, the chips in `TransactionForm`.

### Profile: the period row shows the period, not only the cycle day ✅ done

Picked up from `TODO.md` on 2026-10-19 (plan `docs/superpowers/plans/2026-10-19-profile-period-row.md`). Profile's first row reads
«Periodo» with «Mese solare» or «Ciclo di stipendio · dal 27», and opens a screen with the four kinds and the day grid under the
cycle only. The web Profilo gets the same panel (`?edit=period`); before, it could not change the kind at all.

### Notifications for future transactions & the period recap 🚧 planned

Moved here from `docs/superpowers/plans/README.md` on 2026-10-19. Not built yet. Card charge-day reminders (§5.3) and
budget alerts (§5.8) already use `expo-notifications`; these three reuse that same permission flow and scheduling
pattern (`{kind}:{id}` notification ids, rescheduled on write, none when the thing they warn about no longer applies).

- [ ] **Reminder ahead of a future (scheduled) transaction.** A per-transaction lead time (e.g. "1 giorno prima" /
      "il giorno stesso") so a user with `date > today` (§5.3, "In arrivo") gets warned before it lands, not just on
      the day. Needs a field on the transaction (or a global default) for how far ahead to notify.
- [ ] **Notification when a scheduled transaction reaches its date.** Distinct from the reminder above: fires *on* the
      day a transaction moves from "In arrivo" into the counted totals, so the user learns balances changed without
      opening the app. One per transaction (`transaction-due:{id}`), cancelled if the transaction is edited to a later
      date or deleted before firing.
- [x] **Notification when the period recap is ready.** Already built with the recap: `PeriodRecapGate` schedules a
      09:00 notification on the first day of the new period (`period-recap:` ids, `recapSchedule.ts`). The old note
      said it was missing; it was stale.

### Fees on transfers between accounts

Moved here from `TODO.md` on 2026-10-19. Not asked for as work yet; most of it reopens a product decision.

A transfer can cost money: PayPal charges to move a balance to a bank account, a card withdrawal has a fee, a foreign
transfer loses something on the exchange. Today a transfer moves the same amount out of one account and into the other,
so the fee has to be entered by hand as a separate expense — or it just disappears, and the destination balance no
longer matches the real one.

Open questions before this can be planned:

- [ ] Is the fee a field on the transfer (`feeMinor`, charged to the source account), or a separate expense
      transaction linked to the transfer?
- [ ] Which account pays it, and in which currency, when the two accounts differ?
- [ ] Does the fee show up in the expense totals and in the category breakdown (a "Commissioni" category?), or does it
      stay outside them like the transfer itself?
- [ ] Does it belong in the recurring transfers too (a monthly transfer with a fixed fee)?

### Tag detail: the total ignores income ✅ done

Noticed on 2026-09-25. `apps/mobile/app/tag/[id].tsx` computes its hero figure as
`tagged.filter((tx) => tx.kind === 'expense')`, under the label `tags.total` = «Totale uscite», and the
category split below it comes from `spendingByCategory`, which is expenses too. The transaction list under
them lists *every* tagged row, income included — so a tagged refund or reimbursement shows in the list and
changes nothing above it. For the tag the app itself advertises («un rimborso da chiedere», `tags.footnote`)
that is the wrong answer: the trip cost 800 € and 300 € came back, and the screen still says 800 €.

- [x] Decide before planning (2026-09-25): **two figures**, «Totale uscite» and «Totale entrate» side by side, never
      netted; the Statistiche tag card follows (the income sits signed under each tag's spend). The net difference
      lost because it stops matching the category split and nets a tag's unrelated uses; the middle option lost to
      keeping the screen the same shape for every tag.
  - Both figures count what the split counts — rows flagged `excludeFromTotals` no longer land in the hero, which
    they did before while the split already left them out.
- [x] The bottom caption reads both figures; the category split stays expenses; the Statistiche card (§5.7) shows
      the same two directions.
- [x] Transfers stay out of both figures (`tagTotals` skips them, with a test).
- [x] New i18n keys in every locale; spec §5.10 and §5.7 updated, then the plan
      (`docs/superpowers/plans/2026-09-25-tag-income.md`) and the build.

## 0.2 — Forecast: the next three months, from what already repeats

Discussed on 2026-09-21. The ask: a simple forecast of the coming months from past spending. The app already
computes every input it needs, so this is a projection layer on top of §5.5 and §5.7, not a new model.

**What it shows.** In Statistics, on the current period, the cashflow chart (§5.7) shows the two closed periods, the
current one and **three forecast periods**, drawn dimmed and hatched; the row «Al {data} circa {saldo}» under it opens
a sheet with the detail (spec §5.17, D29). For each forecast period:

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
  injected `today`, unit-tested first. Screens only load the transactions and recurrences and render.
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

**UI decided 2026-09-26** (mockup `docs/superpowers/mockups/2026-09-26-forecast-variants.html`, «Finestra +
dettaglio»): six columns stay six — 2 closed + current + 3 forecast — so nothing is abbreviated at 320px; no scroll
inside the chart, because the header's ‹ already walks back and a custom range or a closed period shows the six
historical columns as before; the detail (one row per forecast period with the min–max band) is a sheet, not a card.
The line reads «Al {data} circa» so it works for every period kind, and the function is `forecastPeriods` («period» is
the general word now).

- [x] Plan `docs/superpowers/plans/2026-09-26-forecast.md` — core function, chart, sheet, i18n, ⓘ `forecast`,
      and the build.

**Done when:** Statistics shows three dimmed forecast periods with a min/max band and a «Al {data} circa {amount}»
row opening the sheet, hidden with fewer than 3 periods of history, and `forecastPeriods` is unit-tested in
`@saldo/core`.

---

## 0.3 — Web app (spec §17.1)

D3 says `apps/web` «becomes the web app later»; today `apps/web/app/page.tsx` is fifteen lines. The spec
offered two data paths — query `sync_rows` server-side through `@saldo/core`, or run local-first in the
browser with SQLite WASM and the same sync client — and left the choice to a dedicated spec. **Decided
2026-09-22: server-side.** The browser path would duplicate the phone's engine; the server path builds the
projection that 0.4 and 0.5 need anyway.

**Why it matters beyond the browser:** the web app, installable as a PWA, is how Saldo reaches people who
will not sideload, without waiting for an App Store build.

**What it builds for everyone after it:** the typed projection. Server code loads a user's rows from
`sync_rows`, validates them against `entitySchemas`, and hands them to the same pure functions the phone
calls. No calculation is written twice; if the web app shows a number the phone does not, one of them is wrong.

**Decided 2026-09-26** (spec §17.1, D30–D36):

- [x] **Where:** the root of the instance (`/`), not a subdomain: the passkey and the cookie stay on one
      origin. `/admin` is the admin panel. The marketing site moves to its own app, `apps/site` (see 0.8).
- [x] **Shared finances: not prepared for.** Queries stay `where user_id = ?` like the sync. Shared
      finances (0.6) ships before the release, so it changes the key with no production rows to migrate (D31).
- [x] **Read and write:** the web writes transactions, accounts, categories, tags, budgets and settings as a
      server-side sync client (server HLC, same upsert as push). Recurrences and attachments stay phone-only.
      Server-side materialisation of recurrences: not now.
- [x] **Email on every account**, required at registration on web and phone. An identifier, not a credential.
      Verification and recovery by magic link only when SMTP is configured. **Decided 2026-09-27:** the
      phone asks for it in onboarding and when it connects to a server, which is also how an account
      created before 0.3b replaces its synthetic `{id}@passkey.saldo.invalid`.
- [x] **Order (decided 2026-09-27):** the design pass (0.3c) comes before auth (0.3b), so the login,
      register and passkey pages are built once, on the approved design and the token variables.
- [x] **Admin panel** for accounts, invites, instance info and **server settings in the database**
      (registration, instance name, SMTP, the AI key of 0.5); env variables win and lock; secrets encrypted
      and write-only.
- [x] **UI:** CSS Modules on token variables with Base UI primitives (decided 2026-09-27 over shadcn/Tailwind), chart geometry shared with the phone, a design pass first.
- [x] **Today** from the synced `settings.timeZone` (filled at onboarding, changed by hand; D37), fallback `DEFAULT_TIME_ZONE`;
      preferences from the synced `settings`.
- [x] **`/home` is a stub until 0.3d (decided 2026-09-28).** 0.3b needs somewhere for `/`'s redirect to land and
      for «Esci» to live, so `/home` ships as a page that names the account and links to the passkeys; 0.3d
      replaces it with the real Home and the top bar around it.
- [x] **Passkey management ships as `/profile/passkeys` before the Profilo shell (decided 2026-09-28).** The
      section is what 0.3b's account needs to be safe (a second passkey, a rename, a delete), and it is already at
      the URL §17.1.7 gives it; 0.3d wraps it in the sub-navigation and the trailing panel rather than moving it.
- [x] **Out:** desktop extras (bulk edit, CSV preview, print) until after release; browser e2e tests.
- [x] **First-run setup is a wizard, without an SMTP step (decided 2026-10-01).** A fresh instance greets the
      self-hoster with a short wizard instead of the `first-user` door and the CLI's first invite (0.3h). SMTP is
      not in it: it is a product setting of `/admin/settings` (D33), registration never depends on mail (D32),
      and the test email needs an account to be sent to, which the wizard is still creating. The last step shows
      the email status and, when it is missing, links to the panel. Variant A · Wizard of
      `docs/superpowers/mockups/2026-10-01-first-run-setup-variants.html`.
- [x] **Mail stays SMTP, and a provider is used through its SMTP relay (decided 2026-10-01).** No native driver
      for Resend, Postmark, SES or the others: every one of them exposes an SMTP relay that works with the
      `SMTP_*` group or the panel as they are (Resend: `smtp.resend.com`, port 465 or 587, user `resend`, the API
      key as the password, a sender on a verified domain). What is missing is the explanation, not the code —
      `docs/self-hosting.md` only ever names Mailpit. 0.3i writes it. A `MAIL_TRANSPORT=smtp|resend` env switch
      with a `fetch` driver (the Documenso and Plausible shape; env-only, locking the panel like `SMTP_HOST`)
      stays an option if a host turns out to block the SMTP ports; the model of the panel (D33, as Immich does
      it) does not change. Survey of how Gitea, Grafana, Mastodon, Immich, Vaultwarden, Nextcloud, Documenso,
      Plausible, Cal.com and Dub do it: in the session of 2026-10-01.

**Steps** (each gets its own plan under `docs/superpowers/plans/`):

| Step | Content | Depends on |
|---|---|---|
| 0.3a | Projection: typed `UserData`, drift tolerance, `today` from `settings.timeZone`; plan `docs/superpowers/plans/2026-09-26-0.3a-user-data.md` | — |
| 0.3b | **Done 2026-09-28.** Auth on the web: cookie session, `/login`, `/register` with email (web and `/auth/mobile`), `/profile/passkeys`, sign-out; the phone asks for the email in onboarding and when it connects to a server, so an account with the old synthetic address gets a real one; plan `docs/superpowers/plans/2026-09-27-0.3b-web-auth.md` | c |
| 0.3c | **Done 2026-09-27.** Design pass: one mockup per page (`docs/superpowers/mockups/2026-09-27-web-{home,transactions,accounts,stats,profile,auth,admin}-variants.html`), choices in spec §17.1.7; `tokensCss()` and the web layout tokens; chart geometry in `@saldo/ui/charts`; plan `docs/superpowers/plans/2026-09-27-0.3c-design-pass.md` | — |
| 0.3d | **Done 2026-09-29.** Read screens: Home, Transazioni, Statistiche, **Conti** and Profilo, matching the phone to the cent; `budgetViews`, `goalViews` and `transactionRow` moved into `@saldo/core` so the two apps share one set of numbers; the period is `?p=<date>` and the filters are query parameters, so every chip and ‹ › is a link; plan `docs/superpowers/plans/2026-09-28-0.3d-read-screens.md`. Conti's read side shipped here rather than in 0.3e (decided with the user 2026-09-28): the list, the pockets, the goals and the account, credit-card and goal panels are reads, and only the account form waits for the other forms. | a, b, c |
| 0.3e | **Done 2026-09-30.** Writes: server HLC, Server Actions through the push upsert, transaction/account/category/budget forms, web onboarding and seed. Four plans, executed in order on `phase/0.3e-writes`: **0.3e-1 done (2026-09-29)** — the server clock, `writeChanges`, the transaction form (new, edit, delete, «Annulla»), «Nuova transazione» in the top bar and the FAB, the keyboard, `/onboarding` and the seed with deterministic category ids; plan `docs/superpowers/plans/2026-09-29-0.3e-1-write-path.md`. **0.3e-2 done (2026-09-30)** — Conti: «Nuovo conto» and the account form, archive/restore and the archived list, goals (new, edit, «Accantona», «Preleva», close in one write, restore), and `/budgets` with the budget form; the forms' rules and the goal plans moved into `@saldo/core`; plan `docs/superpowers/plans/2026-09-30-0.3e-2-conti-budgets-writes.md`. **0.3e-2b done (2026-09-30)** — Profilo's Categorie (create, edit, reorder, archive with move, restore, «Budget mensile»), Budget (moved from `/budgets`) and Obiettivi (the goal form moved out of Conti); plan `docs/superpowers/plans/2026-09-30-0.3e-2b-profile-sections.md`. **0.3e-3 done (2026-09-30)** — Profilo: the preference panels saved on choice (`/profile/preferences?edit=`; language, theme, cycle day, time zone, and the currency after a confirmation), Tag (`/profile/tags`: new, rename, merge, delete) and Dati (`/profile/data`: the JSON backup and the CSV as downloads from `/api/export/*`, built by core's `io/exportFiles`, shared with the phone); the temporary route 0.3e-1 added to sign a browser in without a passkey is deleted, so checking the web UI in a browser now needs a real passkey; plan `docs/superpowers/plans/2026-09-30-0.3e-3-profile-preferences-tags-data.md` | d |
| 0.3f | **Done 2026-10-01.** Admin: accounts, invites, instance, `server_settings` with encryption, SMTP, email verification and recovery. **0.3f-1 done (2026-09-30)** — `/admin` with Account (facts, promote, revoke, restore, delete with the email typed), Inviti (mint with the code shown once as text, link and QR; inspect; revoke) and Istanza, on Profilo's shared shell; plan `docs/superpowers/plans/2026-09-30-0.3f-1-admin-accounts-invites-instance.md`. **0.3f-2 done (2026-09-30)** — `server_settings` with the SMTP password encrypted at rest, `/admin/settings` (instance name, registration mode, SMTP with a test email; an environment variable wins and locks), `SETTINGS_ENCRYPTION_KEY` required, `REGISTRATION` optional; plan `docs/superpowers/plans/2026-09-30-0.3f-2-server-settings-smtp.md`. **0.3f-3 done (2026-10-01)** — email verification (on registration and from Profilo → Account) and recovery of a lost passkey by a magic link to a verified address, through a confirmation page; needs SMTP, without it nothing changes; plan `docs/superpowers/plans/2026-09-30-0.3f-3-email-verification-recovery.md`. | b |
| 0.3g | **Done 2026-10-01.** PWA: a manifest named after the instance, icons from the mascot (192, 512, maskable, apple-touch, favicon), a hand-written service worker that serves a localized offline page to a navigation with no network and caches nothing else, registered in production only; the Docker image now ships `public/`; plan `docs/superpowers/plans/2026-10-01-0.3g-pwa.md` | d |
| 0.3h | **Done 2026-10-03.** First-run setup: while the instance has no account, `/`, `/login` and `/register` send to `/setup`, a four-step wizard — **Benvenuto** (version, database reached, no account yet), **Il tuo server** (instance name, registration mode; a value set by `INSTANCE_NAME` or `REGISTRATION` shows locked), **Il tuo account** (name, email, passkey: the first account, with the `admin` role), **Pronto** (summary; the email line reads «configurata dall'ambiente» under `SMTP_HOST`, «configurata» for a stored configuration that still reads, otherwise «non configurata» with a link to `/admin/settings?edit=smtp`; an optional first invite when the mode is `invite`) → `/home`. Writes the name and the mode to `server_settings` only where the environment does not set them. Once an account exists `/setup` is gone, so `first-user` loses its reason on a fresh instance; the CLI stays for the day no admin can sign in. No SMTP step (see the decision above). The policy lets the first account in under every mode and with no code (decided while planning, 2026-10-03): what `first-user` did for one mode the wizard now does for all, and the window closes with the first account. Mockup `docs/superpowers/mockups/2026-10-01-first-run-setup-variants.html`, variant A; plan `docs/superpowers/plans/2026-10-03-0.3h-first-run-setup.md` | b, f |
| 0.3i | **Done 2026-10-03.** Docs only: how to send mail through a provider. A «Provider via SMTP» section in `docs/self-hosting.md` with one worked example per provider (Resend, Postmark, Amazon SES, Mailgun, Brevo), each as the five `SMTP_*` lines and as the same values typed into `/admin/settings?edit=smtp`; the domain verification (SPF, DKIM; DMARC where the provider requires it) the provider asks for before it accepts a sender; which ports pass `transportSecurity` (465 implicit TLS, any other port STARTTLS, plain only to `localhost`; Resend and SES also 2465 and 2587, the others 2525, for hosts that block the usual ones); the test email as the check. The same example, shortened, in `apps/web/.env.example` and the compose file's comments. No code, no spec change; plan `docs/superpowers/plans/2026-10-03-0.3i-mail-provider-docs.md` | f |
| 0.3j | **Done 2026-10-19.** Change of a real email address, with verification: the new address gets a link, and the swap happens only when the link is opened; the old verified address gets a notice. **Decided:** Better Auth's own `/change-email` is not used — its link is a replayable JWT keyed by the old address, opening it creates a session, it has no hook for the old address and it stores nothing. The change is a row in `email_changes` (migration `0007`), and the library endpoint stays disabled; a test pins it. Needs SMTP; without it nothing changes. The phone is unchanged. Plan `docs/superpowers/plans/2026-10-19-change-email.md` | f |

**Done when:** a user registers on the web or signs in with the phone's passkey, sees Home, transactions and
Statistics matching the phone to the cent, adds a transaction that reaches the phone on its next sync, and
installs the app to the home screen; a self-hoster's first visit to a fresh instance ends with an admin account and
nothing left to do on the command line; an admin runs the instance from `/admin`; the projection is the only way
server code reads rows.

---

## 0.4 — MCP server: the user's own assistant reads and writes their data

Idea from 2026-09-22. The server exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint so
an assistant the user already runs (Claude, or any MCP client) can ask «quanto ho speso in Spesa questo ciclo?»
and get the answer from the user's own instance. It is the mirror image of the AI milestone (0.5): there the
server holds a key and calls a model; here the user's model calls the server, and no key ever touches Saldo.

**What it stands on.** The projection built by 0.3. MCP is its second consumer, not a new model.
Everything money-related is already a pure function in core (cycle totals, budgets, «Quota impegnata», the
forecast of 0.2), so the tools are thin wrappers that load rows, call core and return numbers as integer minor
units plus the currency.

**Decided 2026-10-03** (spec §17.4, D39–D40), after the interview in the session of that day:

- [x] **Sits beside the AI milestone (decided 2026-10-01, D38).** Two audiences: a technical user runs Claude Code or
      another MCP client, connects the instance and combines it with their other integrations; a
      non-technical member of the same instance wants the insights in the app without a client to set up. On an
      instance the admin holds the key anyway (D36), so the second audience costs them nothing. The price is
      two paths that must answer alike: the insights prompt of 0.5 is fed by **the same tool functions** this
      milestone writes, called in-process, so there is one definition of «what a model is told about the user»,
      one §18 paragraph for both, and a question asked in Claude and in the app gives the same numbers. MCP
      still ships first: it has no key, no consent screen and no prompt to tune, and it is where the tool
      shapes get tested before a prompt depends on them.
- [x] **OAuth 2.1 only, no personal access token (D39).** The sketch above this decision had a token minted in
      Profile and pasted into the client; it is dropped. The connectors of claude.ai and the Claude apps accept
      only OAuth, and the CLIs speak it too, so one credential surface serves everybody. Saldo is its own
      authorization server through `@better-auth/oauth-provider` on the Better Auth instance already there:
      dynamic client registration, PKCE S256, redirect URIs `https` or loopback, **opaque tokens stored hashed and
      checked on every call** — revoking in Profile stops the next request, no JWT to wait out. Access 1 h; refresh
      rotated on use, 180 days from the last rotation, the phone session's bound. `@better-auth/mcp` was
      considered and set aside: it issues JWTs, so a revocation would land only when the token expired.
- [x] **Reads and writes, two scopes (D40).** `read` and `write`, shown as two lines on `/oauth/consent`; the
      user can refuse `write`. The write perimeter is the web's (transactions, accounts, categories, tags,
      budgets, goals; no recurrences, no attachments), through the same server write functions, rules and `basis`
      check. The client is what asks the person to confirm a write.
- [x] **Transport:** `POST /mcp`, Streamable HTTP, stateless, JSON responses, on the `@modelcontextprotocol/server`
      SDK (v2). The tool catalogue — names, English descriptions, Zod schemas, annotations, pure `run` functions,
      the `initialize.instructions` text — lives in `@saldo/core/assistant`, which 0.5 reuses. Amounts come as
      `{ minor, currency, amount }`; no aggregate is computed outside core, and a parity test checks a tool
      against the page it mirrors.
- [x] **Profile → «Connettori»** (`/profile/connectors`, the name Claude uses; it was «App collegate» in the mockup): the endpoint to copy, one row per consent with the scopes,
      the dates and «Ultimo uso» (a table of ours, written at most once a minute per pair), «Revoca». The admin
      has a page of its own, `/admin/mcp`, with the switch (`mcp.enabled`; `MCP_ENABLED` wins and locks) and
      three aggregate numbers. The copy says «MCP», never «assistente» (spec §17.4.3).
- [x] **Limits:** 120 requests per minute per token, 1 MB bodies, one registration per minute per IP; `SECURITY.md`
      gains «MCP and connectors», `docs/self-hosting.md` «Connecting an MCP client» (`PUBLIC_URL` must be
      `https`).
- [x] **Out:** device authorization grant, client credentials, OIDC, DPoP, CIMD, resources/prompts/sampling —
      each the day a client needs it.

**Steps** (each gets its own plan under `docs/superpowers/plans/`):

| Step | Content | Depends on |
|---|---|---|
| 0.4-ui | **Done 2026-10-03.** Design pass first (asked by the user 2026-10-03): one harness `docs/superpowers/mockups/2026-10-03-mcp-apps-variants.html` with variants of `/profile/apps`, `/oauth/consent` and the admin panel in their states; the user picked — Profile (renamed «Connettori», `/profile/connectors`): «Collega» of C with the rows and panel of B; consent: C; admin: C, its own page `/admin/mcp`; the copy says «MCP» — and spec §17.4.3 records it | 0.3 |
| 0.4a-1 | Plan `2026-10-03-0.4a-1-mcp-core-catalogue.md`: the tool catalogue in `@saldo/core` — the eleven read tools (`get_preferences`, `list_*`, summaries, forecast), `assistantInstructions`, parity tests against the pages | ui |
| 0.4a-2 | Plan `2026-10-03-0.4a-2-mcp-oauth-endpoint.md`: `@better-auth/oauth-provider` (better-auth → ^1.7.7), discovery documents, `mcp.enabled`/`MCP_ENABLED`, `mcp_usage`, `POST /mcp` on `@modelcontextprotocol/server` v2, the full OAuth flow test | ui (beside a-1; its server tasks wait for a-1's exports) |
| 0.4a-3 | Plan `2026-10-03-0.4a-3-mcp-screens-docs.md`: `/profile/connectors` («Connettori»), `/oauth/consent`, `/admin/mcp` on the chosen variants, strings in seven locales, `SECURITY.md` and `docs/self-hosting.md` | a-1, a-2 |
| 0.4b | **Done 2026-10-04.** Plan `2026-10-03-0.4b-mcp-write-tools.md`: the fourteen **write** tools through `apps/web/src/server/write/*`; a write names the `updatedAt` it read (`expectedUpdatedAt`), so a phone's edit in between is never overwritten — and the web's edit forms and confirms send the version their page loaded the same way (spec §17.4.2 «As built (0.4b)») | a |

**Done when:** a user connects an MCP client to their instance through the browser consent alone, asks about the
current period, and the answer matches Statistiche to the cent; with `write` granted, a transaction the assistant
creates reaches the phone on its next sync; revoking the app in Profile turns the assistant's next call into a 401;
an admin switches the whole thing off from `/admin/mcp`.

---

## 0.7 — Public repository ✅ done (2026-10-20)

What stands between this repository and its first public push. Audited on 2026-09-18. The repository has
no remote yet, so the first push publishes the whole history at once: 1,220 commits on 2026-10-20.

**Verified clean and needing nothing:** no `.env`, keystore, `.p12` or personal CSV was ever added in
history; no `sk-`/`ghp_`/`AKIA`/private-key patterns in tracked files; `.env*`, `.vercel`, `.screenshots`
and `transactions_export_*.csv` are ignored; the screenshots in `docs/screenshots/` are demo data with no
real figures; the Spendee fixture is anonymised (`"A Person"`, `"My Money"`); dependency licences hold no
copyleft trap (`node-forge` is dual BSD-3/GPL-2, `@img/sharp-libvips-*` is an LGPL native binary Next pulls
in). The commit author address stays as it is: the repository will be `saliougaye/saldo`, so the name is
public either way.

**History rewritten on 2026-10-20, before the first push.** The Claude `Co-Authored-By` and «Generated with Claude
Code» trailers are removed from every commit. The commits of the tool «T3 Code» now carry the author
`Saliou Gaye <gayesaliou29@gmail.com>`, so the history has one identity. The tree is unchanged. The old refs are in
`~/saldo-pre-rewrite-2026-10-20.bundle`. Two commit bodies still use the word «Claude» in prose. They are not trailers.
Push only `main`: never `--all`, `--mirror` or `--tags`, because the local repository also holds `refs/t3/*`, `refs/stash`
and old branches with the old history.

### Blockers — none of these survive the first push

- [x] **A security contact.** `SECURITY.md` points to GitHub's private vulnerability reporting only, with a fallback:
      a public issue titled «Security report» that holds no details. No email address is published (decided
      2026-10-20). **Still open, needs the user:** turn the reporting on after the repository exists; the link in
      the file shows nothing until then.
- [x] **The repository slug.** `docs/building-android.md`, `docs/building-ios.md` and `docs/self-hosting.md` named
      `github.com/saldo-app/saldo`, which does not exist. They name `saliougaye/saldo` since 2026-10-18.
      `apps/web/app/page.tsx` no longer names a slug.
- [x] **References to a prototype that is not published.** Done on 2026-10-20: `AGENTS.md` keeps the prototype as an
      optional step, `CONTRIBUTING.md`, the POC spec header and the source comments say that it is not part of the
      repository. Older plans still quote `docs/design` in code listings; they stay as they are. Original note: `docs/design/` is gitignored and stays that way,
      but `AGENTS.md:11` sends every implementing agent to `docs/design/README.md` and the line ranges of
      `Spese.dc.html`, `CONTRIBUTING.md:11` links the same README, and source comments cite its line numbers
      (`packages/ui/src/icons.ts:3`, `packages/ui/src/tokens.ts:1`, `packages/i18n/src/locales/it.ts:1`,
      `src/features/stats/CashflowChart.tsx`, `SpendHistoryChart.tsx`, `scripts/generate-demo-data.mjs`). A
      public contributor follows those to a 404. Rewrite each reference to say what the file *was* and that
      it is not part of the repository, without pretending the tokens and icons came from nowhere.

### Worth doing in the same pass

- [x] **Community health files.** Done on 2026-10-20: `CODE_OF_CONDUCT.md`, issue forms, a pull request template and `dependabot.yml`. Original note: No `CODE_OF_CONDUCT.md`, no `.github/ISSUE_TEMPLATE/`, no
      `PULL_REQUEST_TEMPLATE.md`, no `dependabot.yml`. `CONTRIBUTING.md` tells people to open an issue
      describing the behaviour before sending a fix, and gives them no template to shape it.
- [x] **Decide what happens to `.claude/`, `.agents/` and `skills-lock.json`.** Ignored in `.gitignore` (2026-10-20). Original note: All three are untracked
      *and* un-ignored, so a `git add .` before the first push commits them. Either ignore them or commit
      them on purpose.
- [x] **Local paths and a first name in tracked files.** Done on 2026-10-20: the paths are `<repo>`, the display name in `admin.test.ts` is «Dora». Older plans still use the `rtk` prefix; `AGENTS.md` says it is a private wrapper. Original note: `/Users/saliougaye/…` and `rtk proxy` (a private
      local wrapper) appear in `docs/superpowers/plans/2026-09-13-11-release-and-hardening.md:978,1076,1250`
      and `2026-09-19-more-colors-icons.md`, and `apps/web/src/server/auth/admin.test.ts:88` uses `'Saliou'`
      as a display name. Cosmetic, but the paths read as an accident rather than a choice.
- [x] **A dependency gate in CI.** Done on 2026-10-20: `security.yml` runs `pnpm audit --prod --audit-level critical` when
      a lockfile or a `package.json` changes, on `main`, weekly and on demand; `codeql.yml` scans JS and TS. The level is
      `critical` because 11 `high` advisories remain, all in build tooling (Expo CLI, Jest, Astro). The audit also found
      3 critical and 14 high advisories in production dependencies. They are fixed: `next` 16.3.4 to 16.4.2 and a root
      override `shell-quote ^1.11.0`. Original note: `.github/workflows/ci.yml` runs lint, typecheck and test only. A public
      repo gets Dependabot, CodeQL and secret-scanning push protection for free; `pnpm audit` is one more
      step.
- [x] **The phase index understates what works.** The passkey ceremony was run on a real phone on
      2026-09-18 and it works; the user confirmed it again on 2026-10-19. Six phases ended with a sentence saying
      it had never been driven — 06, 06b, 07, 08, 10 and 11 in `docs/superpowers/plans/README.md`. They now say
      that the sign-in works on a phone and list what is still not exercised. Done on 2026-10-19.
- [x] **Say that `main` is pre-release.** Done on 2026-10-20 in the README. Original note: Shared finances (0.6) changes the key of `sync_rows` after the
      repository is public. The README states that no migration is promised before the first release (0.9), and
      that a self-hoster who runs `main` with real data does so at their own risk.

**Still needs the user, on GitHub (2026-10-20):**

- [x] Create the empty repository `saliougaye/saldo` (no README, licence or `.gitignore`), add the remote and push `main`.
- [x] Turn on private vulnerability reporting, secret scanning with push protection, and Dependabot alerts.
- [x] Protect `main`: require the `check` job of CI and `analyze` of CodeQL, and require pull requests. Create the `e2e` label. The ruleset requires 0 approvals, because there is one maintainer.
- [x] Do not turn on the CodeQL «default setup»: it conflicts with `codeql.yml`. Run the Security workflow once.
- [ ] Look at `packages/core/src/io/__fixtures__/spendee.csv` once (12 rows, anonymised).
- [x] Check Settings → Community Standards. The profile shows 100%.

**Done when:** the repository is public at `github.com/saliougaye/saldo`, private vulnerability reporting
is on, and a stranger can follow every link in `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and
`AGENTS.md` without hitting a 404 or a private path.

---

## 0.8 — Marketing website & docs library, in `apps/site` ✅ done (2026-10-21)

Its own milestone since 2026-09-26, between going public and the first release: the site is the page a release
note, a Spendee forum post or a self-hosting list links to, so it is live before there is a release to announce.

Asked for on 2026-09-24. A public repository is not a visible one: today a stranger's only way in is the
README, and the only page Saldo serves is the fifteen-line landing page every instance shows
(`apps/web/app/page.tsx`). Two things give the project a face. They share one set of design tokens,
`@saldo/ui`:

- **Marketing site.** What Saldo is, who it is for (people leaving Spendee's paid tier, self-hosters), the
  screenshots from `docs/screenshots/`, the local-first / own-your-data pitch, and the two calls to action:
  the repository and the self-hosting guide.
- **Docs library.** The guides that exist as loose Markdown in `docs/` — `self-hosting.md`,
  `building-android.md`, `building-ios.md` — plus `SECURITY.md`, `CONTRIBUTING.md` and the user guide of 0.1
  («Guida»), organised, searchable and linkable. The Markdown files stay the source of truth, so a page on
  the site and the file on GitHub cannot say two things.

**Decided 2026-09-26 (D35):** not inside `apps/web` after all, but a separate app, `apps/site`, with its own
deploy. The instance root is the web app of 0.3, and an instance build carries no marketing and needs no flag.
The paragraphs below keep the original reasoning; where they say `apps/web`, read `apps/site`.

**Decided 2026-10-18 (D41–D52, spec `docs/superpowers/specs/2026-10-18-marketing-site.html`):**

- The first release is the landing page only. The docs library is a separate plan, 0.8b.
- `apps/site` is an Astro app with static output. It is not a Next.js app. The earlier text chose Next.js,
  but nobody compared it with Astro. The reasons for Astro:
  - Astro sends no JavaScript by default. The page needs scripts only for the carousel, the copy buttons and
    the theme toggle. Each one is a small script, with no UI framework.
  - Astro imports TypeScript from the workspace packages. The build reads the `@saldo/ui` tokens and the
    keys of `en.ts`.
  - Starlight, the Astro docs framework, can fit the docs library. A glob loader may read the Markdown in
    `docs/` in place. This is to verify in the docs plan.
  - Next.js adds a React runtime and hydration to a page that is almost all static. It gives no advantage for
    docs.
- English only at the start. The site copy is in one object for each locale, in `apps/site`, so Italian is one
  more object later. The app strings on the phone screens come from `@saldo/i18n`, and the build fails when a key
  that the site uses leaves `en.ts`.
- The site is its own Vercel project, with the root directory `apps/site`. The domain is
  `getsaldo.bysali.com` (decided 2026-10-19; `saldo.bysali.com` is the author's own instance). The build reads
  it from `SITE_URL`, or, if that is unset, from the production domain that Vercel gives it. `SITE_URL` is optional: set
  it to `https://getsaldo.bysali.com` only if the canonical URL is wrong. The code contains no domain.
- The phone screens are HTML from the tokens, not screenshots. They follow the theme and can change language.
- The site has no automated tests and no carousel physics (D52, 2026-10-19). The carousel is native scroll with CSS
  scroll-snap.

- [ ] Decide before planning:
  - ~~**Instance vs. public site.**~~ Settled by D35. Every self-hosted instance serves `apps/web`, so its `/` must not become an
    advert for the project. Either the marketing routes are a route group switched on by an env flag (off in a
    self-hosted build, on for the public deploy), or the public site is its own build target of the same app.
    The instance's root stays the small status/landing page it is now, or the web app of 0.3.
  - ~~**Hosting.**~~ Settled on 2026-10-18: Vercel, its own project. The domain is `getsaldo.bysali.com`
    (2026-10-19); the build reads it from `SITE_URL`.
  - ~~**Docs tooling** (0.8b).~~ Settled on 2026-10-20 (D53): Starlight in `apps/site`. A `glob()` loader reads
    the Markdown in place, from the repository root, with no copy. A spike proved it before the spec.
  - ~~**Languages.**~~ Settled on 2026-10-18: English first. The site copy is a site-local object for each
    locale, not part of `@saldo/i18n` (D43).
  - Whether the docs carry a version selector once 0.9 has tags, so a self-hoster reads the guide that
    matches the release they run. Not before 0.9: there is one version to show (D56).
- [x] Spec for the landing page, with the design pass on `@saldo/ui` tokens (2026-10-18):
      `docs/superpowers/specs/2026-10-18-marketing-site.html`. Mockup:
      `docs/superpowers/mockups/2026-10-18-marketing-site-product.html`.
- [x] Plan for the landing page (0.8a, 2026-10-18): `docs/superpowers/plans/2026-10-18-0.8a-site-landing.md`.
- [x] Build the landing page (0.8a).
- [x] The landing page is live at `https://getsaldo.bysali.com` (2026-10-20). The canonical URL, `og:url`, `robots.txt` and
      the sitemap name that domain. The Vercel project has the root directory `apps/site` and keeps
      `apps/site/vercel.json` (`framework`, `installCommand`, `buildCommand`, `outputDirectory`): without it Vercel falls
      back to the root `vercel.json` of the web app and the build stops with `NEXT_NO_VERSION`.
- [x] Spec for the docs library (0.8b, 2026-10-20): `docs/superpowers/specs/2026-10-20-docs-library.html`
      (D53–D60).
- [x] Plan for the docs library (0.8b, 2026-10-20): `docs/superpowers/plans/2026-10-20-0.8b-docs-library.md`.
- [x] Build the docs library (0.8b): `/docs/` with the Guide, self-hosting, the two build guides, security and
      contributing, and search. The landing page links to it.
- [x] The docs library is live at `https://getsaldo.bysali.com/docs/` (2026-10-21). A commit that changes only a
      guide deploys the site (D59): the three docs-only commits of PR #6 each started a Vercel deploy.
- [x] The guides are in Simplified Technical English, with SVG diagrams in `docs/diagrams/` (2026-10-21). GitHub
      shows a diagram as an image; the site puts it inline and colours it with the theme tokens.

Depends on: 0.7 — the slug and dead-link fixes (the site links to the repository) and the docs being correct,
the phase-index fix included. It does **not** depend on 0.3: the marketing routes read no user data.

**Done when:** the marketing site and the docs library are live on the public domain, every call to action
reaches the public repository or a guide, and each docs page renders from the Markdown file in `docs/` it
claims to show.

---

## 0.9 — Releases & stores

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

Since 2026-09-25 the app starts without a server and asks for its address, so **one official APK can exist**;
a fork that builds its own only has to own the bundle id and the signing key. Two things make either easy:

- [ ] A tagged server image on `ghcr.io`, so `docker compose` pulls instead of building. Tagged with the
      same version as the release, and `latest` only on a tagged build.
- [ ] A reusable workflow a user runs in their own fork, with their own bundle id and signing
      secrets, producing a signed APK as an artifact. It pins itself to a tag too, so the APK a user builds
      says which release it is.

The second one needs care in the writing: keystore-in-secrets guidance.

### The stores: the app that people install without building it

Added on 2026-10-24. An APK in an artifact or a build from source is not enough: most people will install the
app from the **Google Play Store** and the **Apple App Store**. This replaces an earlier rule of this file, that
the repository never publishes an app of its own because it would point at the wrong server. That rule no longer
holds. Since 2026-09-25 the app starts without a server and asks for its address, so one official build works with
every instance. The passkey ceremony runs in the browser and comes back through the `SALDO_SCHEME` redirect, so the
official build uses the default scheme and no server needs a file that names the app.

A fork that wants its own bundle id and signing key keeps the workflow above. The official build is a second, separate way.

- [ ] Decide before planning:
  - [ ] The identity: the bundle id and the Android package (the default in `app.config.ts` is `io.github.saldo.app`; the id of a
        store app cannot change afterwards), the developer name that the store shows, and the support address.
  - [ ] The cost and the owner of the accounts: Google Play Console (one payment) and Apple Developer Program (a
        yearly payment). Decide whether they belong to a person or to an organisation.
  - [ ] The first channels: Play internal and closed testing, and TestFlight, before the public listing.
  - [ ] How a store reviewer sees the app. A reviewer has no server. Local-only mode already works without one, but
        Apple can ask for a demo server and an account. Decide who runs it.
- [ ] The listing: name, description and screenshots in Italian and English, the icon, the privacy policy page on
      the site, the data safety form (Google) and the privacy labels (Apple). The text says that the app sends data
      to the server that the user types, and to no other server.
- [ ] Release builds from a tag, by a workflow in this repository: an Android App Bundle signed with the upload key,
      and an iOS archive. The signing secrets stay in GitHub secrets. Add a `docs/releasing.md` that follows the docs
      rules.
- [ ] Upload to the testing tracks from the workflow (Play API, App Store Connect API). The first public review
      stays a manual step.
- [ ] A compatibility rule between the store app and the server version. Phones update on their own and servers do
      not: the `409` on a `SYNC_SCHEMA_VERSION` mismatch must tell the person to update the server, in words.
- [ ] The site (0.8) links to both stores, and `docs/self-hosting.md` says that the store app is the usual way to install.
- [ ] Replace the «`main` is pre-release» notice in `README.md` and the proof-of-concept line in `SECURITY.md` with the
      text of a first release: what a release promises, and that from now on a change of the data format ships with a
      migration.

**Done when:** `docs/self-hosting.md` quick start pulls an image instead of cloning, `/api/health` reports
the tag it was built from, a fork owner gets a signed APK without a Mac, and a person finds Saldo in the Play
Store and the App Store and connects it to their own server.

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
descriptions unless the user opts in; results cached per cycle. **Ships beside 0.4, not instead of it**
(decided 2026-10-01, D38): the user with an MCP client gets the same answers from their own assistant, the user
without one gets them in the app. The prompt is built from the output of the MCP tool functions of 0.4, called
in-process, so the two never describe the user's finances differently.

**To decide before planning:**

- [x] Key **per instance** (decided 2026-09-26, D36): the admin sets it in `/admin` (server settings of 0.3,
      encrypted at rest), everyone on the instance uses it, the admin pays.
- [x] Insights ship, beside 0.4 (decided 2026-10-01, D38; see 0.4). Their input is the 0.4 tool output.
- [ ] The wording of the §18 change and of the consent screen.
- [ ] The local-only mode (0.1, «A first run with no server») has no AI. Write that down where that
      idea is planned.
- [ ] Spike, then spec update (§17.2, §17.3, §18), then the plan.

**Done when:** a user on an instance with a key scans a receipt into a prefilled sheet, an instance without a
key never contacts a provider, and §18 says exactly what leaves the server and when.

---

## 0.6 — Shared finances

Saldo exists to replace Spendee's paid features (§1), and shared wallets is one of them. Spec §1.2 excludes
households from the POC; this is the note that it is the next non-goal to fall.

**After the first store release, decided when it starts** (changed 2026-09-26, 2026-10-19 and 2026-10-24). It was
meant to be decided before 0.3 so the web app would not be rewritten, and later to ship before any release, while
there are no production rows. Since 2026-10-24 it ships after 0.9: changing the key of `sync_rows` and the web app's
`where user_id = ?` now costs a migration of **real data**. 0.3 and 0.4 do not prepare for it. The plan must contain:

- a forward migration on the server: each existing user gets a personal space that owns their rows;
- a `SYNC_SCHEMA_VERSION` bump, so a phone that has not updated gets the `409` and the message from 0.9;
- a path for the local rows on a phone that updates later than the server;
- a test that migrates a database filled by the previous release.

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

- [ ] Which shape, or which first. Spendee's **shared wallet** (share one wallet, not the whole account) is
      the lead candidate. Accounts carry a real email from 0.3 (D32), which is how a member would be invited.
- [ ] Trust between members: `SECURITY.md` says today that two people who do not trust each other on one
      server are not served. Shared finances either keep that line or have to earn its removal.
- [ ] Spec section (`§5.x Shared finances`), then the plan.

**Done when:** two phones with two passkeys see the same transactions, budgets and accounts, the
10b stopgap label comes off, and an instance that runs the last 0.9 release updates without losing a row.

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
