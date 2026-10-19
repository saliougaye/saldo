# Profile: the period row shows the period — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profile's first row names the period («Periodo · Mese solare» or «Periodo · Ciclo di stipendio · dal 27») and opens a screen with the four kinds. The day grid shows under the cycle only.

**Architecture:** Spec §5.2, §6.8, §6.15 and §6.29 do not change in behaviour. The kind is still `settings.periodKind`. The screen `profile/cycle` becomes `profile/period`: the kinds as in onboarding step 1, then the preview and the day grid when the kind is `cycle`. The web Profilo (`/profile/preferences`) mirrors the phone, so its `cycle` panel becomes a `period` panel, and `saveSetting` accepts `periodKind`. No core change: `periodContaining` and `PeriodDef` already do all the work. One text helper in `@saldo/i18n` builds the row value for both apps.

**Tech Stack:** Expo Router, React Native, Next.js 16 App Router, Vitest (PGlite), Playwright, Maestro.

**Spec:** `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` §1.1, §5.2, §6.8, §6.15, §6.29. Plan 08: `2026-09-10-08-periods-and-signin.md`.

**Decisions (2026-10-19):**

- **Phone and web both change.** The web had no way at all to change `periodKind` (`settingInputSchema` refused it), so a web user could not leave the cycle. The web panel gets the same four kinds.
- **The marketing site does not change.** Spec 0.8a §04 lists no Profile screen and `apps/site/src/components/phone/screens/` has none.
- **Label.** The row title is `period.title` («Periodo»). The value is the kind, and for the cycle the kind and the start day: «Ciclo di stipendio · dal 27».
- **Keys.** Delete `profile.cycleStart`. Rename `profile.cyclePreview` to `profile.periodPreview` («The current period»). Keep `profile.cycleDay`, `settings.cycleValue`, `settings.cycleFootnote`.
- **Selection.** A changed kind or day makes the stored range of the Home period a range of the old shape. The new screen calls `resetToCurrent()`, as the period sheet does (§5.2 last bullet).
- **Tests.** One integration test (the real `saveSetting` with PGlite) for `periodKind`. One Playwright flow replaces the cycle flow. No test for the label helper (a mapping) or for the screens (TODO.md already lists the Maestro gaps).

---

## Rules for every task

- **Gates.** Read the output, not the exit code (AGENTS.md «Reading the results»). Run `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck` and `rtk proxy pnpm test`. A clean lint has **no** `lint/…` lines and no `× Some errors were emitted while running checks.`
- To test one file, run `rtk proxy pnpm --filter web test <pattern>`, with no `--`.
- Fix the format before each commit: `pnpm exec biome check --write <files>`.
- Commit each task with a Conventional Commit. End each message with the `Co-Authored-By:` line that the session gives.
- Work on the branch `phase/profile-period-row`. Do not push and do not open a pull request.
- Do not edit `TODO.md`, `ROADMAP.md` or `docs/superpowers/plans/README.md`.

## File structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `packages/i18n/src/periodText.ts` | Create | `periodSummary(def, t)`: «Mese solare» / «Ciclo di stipendio · dal 27». |
| `packages/i18n/src/index.ts` | Modify | Export `periodText`. |
| `packages/i18n/src/locales/{it,en,fr,de,sv,es,pt}.ts` | Modify | Delete `profile.cycleStart`. Rename `profile.cyclePreview` to `profile.periodPreview`. |
| `apps/web/src/server/write/settings.ts` + `.test.ts` | Modify | `periodKind` is a setting the panels can save. |
| `apps/mobile/app/profile/cycle.tsx` | Rename to `period.tsx` | The kinds, the preview, the day grid under the cycle. |
| `apps/mobile/app/profile.tsx` | Modify | The row. |
| `apps/mobile/maestro/guide.yaml` | Modify | The row label changed. |
| `apps/web/src/features/profile/profileRows.ts` | Modify | Key `cycle` becomes `period`. |
| `apps/web/app/(app)/profile/preferences/CyclePanel.tsx` | Rename to `PeriodPanel.tsx` | Kinds, preview and day grid. |
| `apps/web/app/(app)/profile/preferences/page.tsx` | Modify | Use `PeriodPanel` and `periodSummary`. |
| `apps/web/e2e/profile.spec.ts` | Modify | The period flow. |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` | Modify | §6.8 row, the settings table row. |

---

### Task 1: Strings and the label helper

**Files:**
- Create: `packages/i18n/src/periodText.ts`
- Modify: `packages/i18n/src/index.ts`, the seven files in `packages/i18n/src/locales/`

- [ ] **Step 1: Rename the keys in all seven catalogs**

In each `locales/<l>.ts`, in `profile`: delete `cycleStart`, and rename `cyclePreview` to `periodPreview` with this text:

| Locale | `periodPreview` |
| --- | --- |
| it | `Il periodo in corso` |
| en | `The current period` |
| fr | `La période en cours` |
| de | `Die laufende Periode` |
| sv | `Pågående period` |
| es | `El periodo en curso` |
| pt | `O período em curso` |

- [ ] **Step 2: Write the helper**

```ts
// packages/i18n/src/periodText.ts
import type { PeriodDef } from '@saldo/core';
import type { Translate } from './translate';

/**
 * What the period is, in one line: «Mese solare», or «Ciclo di stipendio · dal 27» (§5.2). The
 * start day is shown for the cycle only: the other kinds have no day, and a user who tracks by
 * calendar month must not read about a cycle. Here so the phone and the web say it alike.
 */
export function periodSummary(def: PeriodDef, t: Translate): string {
  const kind = t(`period.kind_${def.kind}`);
  return def.kind === 'cycle' ? `${kind} · ${t('settings.cycleValue', { day: def.startDay })}` : kind;
}
```

Add `export * from './periodText';` to `packages/i18n/src/index.ts`, in alphabetical order after `languageNames`.

- [ ] **Step 3: Typecheck the package**

Run: `rtk proxy pnpm --filter @saldo/i18n typecheck`
Expected: no error about `periodSummary`. Errors about the deleted keys in apps come in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n
git commit -m "feat(i18n): periodSummary and the period preview string"
```

### Task 2: The web can save `periodKind`

**Files:**
- Modify: `apps/web/src/server/write/settings.ts`, `apps/web/src/server/write/settings.test.ts`

- [ ] **Step 1: Write the failing tests**

In `settings.test.ts`: add to the first `it.each` the rows `[{ key: 'periodKind', value: 'week' }, { periodKind: 'week' }]` and `[{ key: 'periodKind', value: 'cycle' }, { periodKind: 'cycle' }]`. Add to the «does not write again» table `[{ key: 'periodKind', value: 'month' }]`. In the «refuses» table, replace the row `['an unknown key', { key: 'periodKind', value: 'week' }]` with `['an unknown key', { key: 'weekStart', value: 'sunday' }]` and add `['an unknown period kind', { key: 'periodKind', value: 'fortnight' }]`.

- [ ] **Step 2: Run, expect FAIL**

Run: `rtk proxy pnpm --filter web test write/settings`
Expected: FAIL (`periodKind` is refused as `invalid`).

- [ ] **Step 3: Implement**

In `settings.ts` add `z.object({ key: z.literal('periodKind'), value: shape.periodKind }),` to the union, before `cycleStartDay`. Change the doc comment: delete the sentence about `periodKind` («`periodKind` is not among them…»).

- [ ] **Step 4: Run, expect PASS**

Run: `rtk proxy pnpm --filter web test write/settings`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/write
git commit -m "feat(web): the preferences can save the period kind"
```

### Task 3: Phone — the row and the screen

**Files:**
- Rename: `apps/mobile/app/profile/cycle.tsx` → `apps/mobile/app/profile/period.tsx`
- Modify: `apps/mobile/app/profile.tsx`, `apps/mobile/maestro/guide.yaml`

- [ ] **Step 1: Rename**

Run: `git mv apps/mobile/app/profile/cycle.tsx apps/mobile/app/profile/period.tsx`

- [ ] **Step 2: Rewrite the screen**

`PeriodSetting` reads `settings`, shows a card with the four kinds (the rows of `(onboarding)/period.tsx`: `ListRow` with `period.kind_*` and `period.kindBody_*`, a check on the chosen one, a rule between rows), then the preview card (`profile.periodPreview` over `formatCycleRange(periodContaining(def, today), locale, today)`), then, when `kind === 'cycle'`, the day grid card of the old screen. Title `period.title`, subtitle `settings.cycleFootnote`, `InfoButton concept="period"`, `card={false}`. A tap on a kind calls `repos.settings.update({ periodKind })` and `resetToCurrent()`. A tap on a day calls `repos.settings.update({ cycleStartDay })` and `resetToCurrent()`. Take `today`, `resetToCurrent` and `def` from `usePeriod()`: the preview follows the settings, which `useSettings()` pushes at once. Keep the grid constants and the cell code unchanged.

The preview uses `{ kind, startDay: settings.cycleStartDay }` from `useSettings()`, so it matches the tap before the provider re-renders.

- [ ] **Step 3: Change the row**

In `profile.tsx` replace the first `ListRow`:

```tsx
<ListRow
  title={t('period.title')}
  leading={lead('cal')}
  trailing={<Text color="textMuted">{periodSummary(def, t)}</Text>}
  onPress={() => router.push('/profile/period')}
  chevron
/>
```

`def` comes from `usePeriod()` and is already destructured in this file. Import `periodSummary` from `@saldo/i18n`. Delete the `settings.cycleStartDay ?? 27` use.

- [ ] **Step 4: Maestro**

In `guide.yaml` replace `Cycle start.*` with `Period.*` (three places: the comment, `visible`, `tapOn`) and change the comment to «Profile → Period has the one for «The period». The row label also holds its value («Period, Pay cycle · from the 27»)».

- [ ] **Step 5: Typecheck and commit**

Run: `rtk proxy pnpm --filter mobile typecheck`. Expected: no errors.

```bash
git add apps/mobile
git commit -m "feat(mobile): Profile's period row and screen choose the kind"
```

### Task 4: Web — the row and the panel

**Files:**
- Modify: `apps/web/src/features/profile/profileRows.ts`, `apps/web/app/(app)/profile/preferences/page.tsx`, `apps/web/app/(app)/profile/preferences/preferences.module.css` (only if the kinds need a spacing rule)
- Rename: `CyclePanel.tsx` → `PeriodPanel.tsx`

- [ ] **Step 1: `profileRows.ts`**

Rename the key `cycle` to `period` in `PREFERENCE_KEYS`. Its entry is `{ labelKey: 'period.title', value: settings.periodKind }`. Update the doc comments: the row shows the period, the day is kept for when the kind is the cycle. `?edit=cycle` links no longer exist; `?edit=` with another value opens nothing, so no redirect is needed.

- [ ] **Step 2: `PeriodPanel.tsx`**

`git mv` the file. Two `useSaveSetting` hooks: one on `kind`, one on `day`. Render: the note; an `Alert` for either error; an `OptionList` (`label` = `period.title`) with the four kinds (`label` `period.kind_*`, `subtitle` `period.kindBody_*`), saving `{ key: 'periodKind', value }`; the preview `formatCycleRange(periodContaining({ kind: shownKind, startDay: shownDay }, today), locale, today)` under `strings.preview`; and, when `shownKind === 'cycle'`, the existing radiogroup of days. Props: `kind`, `day`, `locale`, `today`, `options` (`readonly { value: PeriodKind; label: string; subtitle: string }[]`), `strings: { title, note, preview, day }`.

- [ ] **Step 3: `page.tsx`**

Case `'period'` renders `PeriodPanel` with `options = PERIOD_KINDS.map(...)` resolved with `t`, `title: t('period.title')`, `preview: t('profile.periodPreview')`. The row value is `periodSummary({ kind: settings.periodKind, startDay: settings.cycleStartDay }, t)` for `row.key === 'period'`. Remove the `settings.cycleValue` use.

- [ ] **Step 4: Typecheck and commit**

Run: `rtk proxy pnpm --filter web typecheck`. Expected: no errors.

```bash
git add apps/web
git commit -m "feat(web): Profilo's period panel chooses the kind"
```

### Task 5: Web end-to-end

**Files:**
- Modify: `apps/web/e2e/profile.spec.ts`

- [ ] **Step 1: Update the list of rows** (`'profile.cycleStart'` → `'period.title'`).

- [ ] **Step 2: Rewrite the cycle test** as «the period kind is saved as chosen, the day grid shows under the cycle only, and both survive a reload». Open `period`. Expect no radiogroup named `period.cycleStartDay`. Click `period.kind_cycle`. Expect the day grid and the row text `period.kind_cycle`. Click day 15. Expect the row to contain `settings.cycleValue` with day 15. Reload. Expect the same. Click `period.kind_month`. Expect the grid gone and the row without `settings.cycleValue`.

- [ ] **Step 3: Run if the e2e environment is available** (`pnpm --filter web e2e profile`). If it is not, say so in the final report.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e
git commit -m "test(web): e2e for the period kind in Profilo"
```

### Task 6: Spec

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` (§6.8 row, the settings table row near line 790, §17 if it names the `cycle` panel)

- [ ] **Step 1:** In §6.8 replace «Inizio del ciclo» with **Periodo** and add, in STE: «The row shows the period kind, and the start day for the cycle. The screen `profile/period` lists the four kinds as onboarding step 1 does. The day grid shows under the cycle only. A change of kind or day makes the Home selection fall back to the current period.» Add that the web Profilo has the same panel (`?edit=period`). In the settings table, change «Profile «Inizio del ciclo» screen» to «Profile «Periodo» screen».
- [ ] **Step 2:** Run `grep -rn "Inizio del ciclo\|Cycle start" docs/superpowers/specs/2026-09-10-saldo-poc-spec.md apps packages` and fix what is left, except old plans and mockups.
- [ ] **Step 3: Commit** `docs: spec 6.8 names the period row`.

### Task 7: Gates and review

- [ ] Run `rtk proxy pnpm lint`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm test`. Read the output. Fix what fails.
- [ ] Use requesting-code-review on the branch diff against `main`.
- [ ] Tick the boxes of this plan.
