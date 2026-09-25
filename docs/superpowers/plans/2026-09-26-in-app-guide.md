# In-app explanations: a first-run intro, the ⓘ and a «Guida»

**Goal.** Saldo explains how it thinks in three places, from one text (spec D28, §5.16, §6.40–§6.42; ROADMAP «In-app
explanations: a first-run intro and a «Guida»»).

**Decisions (2026-09-26, mockup `docs/superpowers/mockups/2026-09-26-guide-variants.html`).**

- Intro **1A**: one screen, «Come ragiona Saldo», four rows (period, remaining, transfers, recurring), «Continua».
- ⓘ **2A**: a muted `info` icon after the label opens a sheet with the concept's whole text and «Fatto».
- Guida **3A**: grouped rows with icon, title and summary; a row pushes the concept's page.
- No «Novità» sheet until there are releases (0.8).
- Labels fixed instead of explained: the generic «ciclo» → «periodo» in every language that said «cycle» for the
  period in general; «Includi nel saldo disponibile» → «Includi nel totale spendibile» (it only).
- «Already seen» is `kv.introSeenFor = settings.onboardingCompletedAt`, written on «Continua»; the intro waits for the
  period recap.
- The profile row that always reads «Inizio del ciclo» went to `TODO.md`, out of this plan.

## Steps

- [ ] **Labels.** In all seven catalogues: `txForm.excludeNote`, `recurrence.createsUpcoming`, `stats.cycleTrend`,
      `stats.trendFooter`, `stats.committedLine`, `stats.projection`, `stats.lastCycles`, `stats.legendCurrent`,
      `stats.legendPast`, `stats.average`, `stats.tagsOverlap`, `budgets.medianHint`, `budgets.periodCycle`,
      `budgets.emptyBody`, `home.leftover`, `home.closedCycle` say «period»; it `accounts.includeInSpendable`.
      Update any test asserting the old copy.
- [ ] **Catalogue.** `guide` in every locale: `title`, `subtitle`, `introTitle`, `introFoot`, `infoLabel`
      (`{{title}}`), `section_{basics,accounts,plan,organize,data}`, and for each of the eleven concepts
      `{title, summary, body}` (body paragraphs split on a blank line). Parity test green.
- [ ] **Concepts, test first.** `apps/mobile/src/features/guide/concepts.ts`: `GUIDE_CONCEPTS` (id, icon, section,
      intro), `GUIDE_SECTIONS`, `INTRO_CONCEPTS`, `guideConcept(id)`, `isGuideConceptId`, `paragraphs(body)`. Tests:
      four intro concepts in order; every section used; every concept has non-empty title/summary/body in every
      catalogue; `paragraphs` splits on blank lines and drops empties.
- [ ] **Intro schedule, test first.** `introSchedule.ts`: `INTRO_KEY = 'introSeenFor'`,
      `isIntroDue({ onboardingCompletedAt, stored })`. Tests: null onboarding → false; equal → false; missing or
      different → true.
- [ ] **ⓘ.** `GuideSheet` (icon box, title, summary, body paragraphs, «Fatto») and `InfoButton({ concept })` (16pt
      muted `info`, 44pt hit area, «Informazioni: {title}», owns its sheet). `Sheet` gains `titleAccessory`. Tests:
      the button is labelled and opens the sheet with the concept's text.
- [ ] **Intro.** `IntroSheet` (full-screen `Modal`, staggered rows, fades only with reduced motion, «Continua») and
      `IntroGate` in the tabs layout: due by `isIntroDue`, waits while the recap is open, writes the key on
      «Continua». `PeriodRecapGate` reports whether its sheet is open. Tests: shows once, writes the key, does not
      show when the stored value matches.
- [ ] **Guida.** `app/guide/index.tsx` (sections, rows → page) and `app/guide/[id].tsx` (unknown id →
      `NotFoundScreen`); Profile row «Guida» (`info`) after «Rivedi la configurazione iniziale». Tests: every
      concept is listed; a page renders its body.
- [ ] **Placements.** `accountTypes`: onboarding account-details «Tipo» and `AccountTypeSheet`; `creditCard`:
      `PaymentAccountSheet`; `period`: `PeriodKindSheet` and `profile/cycle`; `budgets`: `BudgetForm` header
      (new and edit); `recurring`: «Ripeti» in `TransactionForm`; `goals`: «Dove li tieni» (`goals.parent`) in
      `GoalForm`.
- [ ] Spec, ROADMAP and plan ticked; `pnpm lint`, `pnpm typecheck`, `pnpm test` clean (read the output, AGENTS.md).
- [ ] Checked on the simulator: intro after a fresh onboarding, each ⓘ, the Guida, a nested ⓘ over a sheet.
