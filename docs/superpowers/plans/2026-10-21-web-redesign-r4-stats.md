# Web redesign R4 — Statistics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Statistics as three blocks: the period, with a chart of one expense bar per period and a dashed «usual» line; the breakdown, in the colours of the categories with share bars; and the tags.

**Architecture:** `apps/web/app/(app)/stats/page.tsx` stays a server component. Two new pure functions carry the logic, both tested:
- `expensesChartView` gives each bar its height, and gives the «usual» median.
- `periodProjection`, taken out of `statsView`, gives the projection of the running period.

`ExpensesChart` is a server component. Its bars are links to their periods, and a CSS tooltip shows the details. A small client component, `PeriodKeys`, moves the period with ← and →. `CashflowChart` and `TrendChart` go, because nothing else uses them.

**Tech Stack:** Next.js (App Router, server components), CSS Modules with the `@saldo/ui` token variables, `@saldo/core`, `@saldo/i18n`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-web-pages-redesign.html`, W6, W7, W8 and W12, section 04 «Statistics», figures 4 and 5. Open item 4 («Keys on Statistics»).

**Mockup (not in the repository):** `docs/design/redesign/stats.html`, variant «bars» (Quota).

**Branch:** `redesign/web`. R1–R3 are done on it.

---

## Decisions this plan takes where the spec leaves a choice

- **The chart has no tooltip on a touch screen.** A tap selects the period, and the figures above the chart then show its values. A forecast period shows its min–max under its figures, and the table «Forecast periods» lists it too.
- **«Usual» is the median of the six closed bars, rounded to the minor unit.** The «above / below the median» note under Expenses keeps the median of `statsView`. That median uses the same six periods, but it is anchored on the selected period, not on today.
- **The projection outline shows on the current bar whatever period is selected.** It uses `periodProjection`, the rule that `statsView` already applies to the selected period.
- **The first six categories have their own colour** in the split bar. The others share one segment in `--color-bar-grey`. A category whose colour index is missing uses `--color-bar-grey` too.
- **The trend chart goes from Statistics** (W8). The Home has it (H5).
- **The loading skeleton of `/stats` stays as it is.** R7 rebuilds the empty states and the skeletons.

## File structure

| File | Change |
|---|---|
| `packages/i18n/src/locales/{en,it,de,es,fr,pt,sv}.ts` | 5 new keys in `stats`. |
| `apps/web/src/features/stats/statsView.ts` | `periodProjection` is taken out and exported. |
| `apps/web/src/features/stats/expensesChart.ts` (+ test) | New: bar heights and the «usual» median. |
| `apps/web/src/ui/charts/ExpensesChart.tsx`, `.module.css` | New: the chart (W6). |
| `apps/web/src/ui/PeriodKeys.tsx` | New: ← → change the period. |
| `apps/web/app/(app)/stats/page.tsx`, `stats.module.css` | Replaced. |
| `apps/web/src/ui/charts/CashflowChart.*`, `TrendChart.*`, `src/ui/Columns.*` | Deleted, if nothing else imports them. |
| `apps/web/e2e/home-stats.spec.ts` | The chart and the keys. |
| `docs/superpowers/plans/README.md` | R4 ticked. |

---

### Task 1: The strings

**Files:**
- Modify: `packages/i18n/src/locales/en.ts`, `it.ts`, `de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `sv.ts` (the `stats` block, after the line `soFar: …`)

- [x] **Step 1: Add the keys**

In each file, after the line that starts with `    soFar:` inside `stats: {`, add the five lines for that locale.

`en.ts`:

```ts
    expensesByPeriod: 'Expenses by period',
    usual: 'Usual',
    usualNote: 'Usual is the median of the last 6 periods: {{amount}}.',
    projectionAboveShort: 'about {{amount}} above usual',
    projectionBelowShort: 'about {{amount}} below usual',
```

`it.ts`:

```ts
    expensesByPeriod: 'Uscite per periodo',
    usual: 'Il solito',
    usualNote: 'Il solito è la mediana degli ultimi 6 periodi: {{amount}}.',
    projectionAboveShort: 'circa {{amount}} sopra il solito',
    projectionBelowShort: 'circa {{amount}} sotto il solito',
```

`de.ts`:

```ts
    expensesByPeriod: 'Ausgaben pro Zeitraum',
    usual: 'Üblich',
    usualNote: 'Üblich ist der Median der letzten 6 Zeiträume: {{amount}}.',
    projectionAboveShort: 'etwa {{amount}} über dem Üblichen',
    projectionBelowShort: 'etwa {{amount}} unter dem Üblichen',
```

`es.ts`:

```ts
    expensesByPeriod: 'Gastos por periodo',
    usual: 'Lo habitual',
    usualNote: 'Lo habitual es la mediana de los últimos 6 periodos: {{amount}}.',
    projectionAboveShort: 'unos {{amount}} por encima de lo habitual',
    projectionBelowShort: 'unos {{amount}} por debajo de lo habitual',
```

`fr.ts`:

```ts
    expensesByPeriod: 'Dépenses par période',
    usual: 'L’habituel',
    usualNote: 'L’habituel est la médiane des 6 dernières périodes : {{amount}}.',
    projectionAboveShort: 'environ {{amount}} au-dessus de l’habituel',
    projectionBelowShort: 'environ {{amount}} en dessous de l’habituel',
```

`pt.ts`:

```ts
    expensesByPeriod: 'Despesas por período',
    usual: 'O habitual',
    usualNote: 'O habitual é a mediana dos últimos 6 períodos: {{amount}}.',
    projectionAboveShort: 'cerca de {{amount}} acima do habitual',
    projectionBelowShort: 'cerca de {{amount}} abaixo do habitual',
```

`sv.ts`:

```ts
    expensesByPeriod: 'Utgifter per period',
    usual: 'Det vanliga',
    usualNote: 'Det vanliga är medianen av de senaste 6 perioderna: {{amount}}.',
    projectionAboveShort: 'cirka {{amount}} över det vanliga',
    projectionBelowShort: 'cirka {{amount}} under det vanliga',
```

- [x] **Step 2: Run the catalog tests**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
rtk git add packages/i18n/src/locales
rtk git commit -m "feat(i18n): strings for the expenses chart of Statistics"
```

---

### Task 2: `periodProjection`, out of `statsView`

**Files:**
- Modify: `apps/web/src/features/stats/statsView.ts`

This is a refactor: `statsView.test.ts` already covers the projection through `statsView`, and it must stay green.

- [ ] **Step 1: Run the tests before the change**

Run: `rtk proxy pnpm --filter web exec vitest run src/features/stats/statsView.test.ts`
Expected: PASS.

- [ ] **Step 2: Add the function**

In `apps/web/src/features/stats/statsView.ts`, add `cycleLength`, `type DateRange` and `elapsedDays` to the `@saldo/core` import (keep the import sorted as Biome wants it). Then, after the constant `MIN_DAYS_LEFT`, add:

```ts
/**
 * §5.7: the end-of-period projection of the period `range`, or `null` — the phone's
 * `showProjection`: a running period, at least `MIN_DAYS_LEFT` days left, and a median of the
 * previous periods to read it against. Statistics also draws it on the running bar of its chart,
 * whatever period is selected (W6).
 */
export function periodProjection(input: {
  txs: UserData['transactions'];
  def: PeriodDef;
  range: DateRange;
  today: LocalDate;
}): number | null {
  const { txs, def, range, today } = input;
  if (!isWithin(range, today)) return null;
  const length = cycleLength(range);
  const elapsed = elapsedDays(range, today);
  if (length - elapsed < MIN_DAYS_LEFT) return null;
  const cycleMedian = median(
    periodSpendHistory(periodHistory(txs, def, range, CASHFLOW_CYCLES), today),
  );
  if (cycleMedian === null) return null;
  return projectEndOfCycle({
    spent: summarizePeriod(txs, range, today).spent,
    committed: committedSpend(txs, range, today),
    elapsed,
    length,
    upcoming: upcomingExpenses(txs, range, today),
  });
}
```

- [ ] **Step 3: Use it in `statsView`**

In `statsView`, delete the lines:

```ts
  const daysLeft = Math.max(0, period.length - period.elapsed);
  const showProjection = period.isCurrent && daysLeft >= MIN_DAYS_LEFT && cycleMedian !== null;
```

and replace:

```ts
      projection: showProjection
        ? projectEndOfCycle({
            spent: summary.spent,
            committed,
            elapsed: period.elapsed,
            length: period.length,
            upcoming: upcomingExpenses(txs, period.range, today),
          })
        : null,
```

with:

```ts
      projection: periodProjection({ txs, def, range: period.range, today }),
```

- [ ] **Step 4: Run the tests again**

Run: `rtk proxy pnpm --filter web exec vitest run src/features/stats/statsView.test.ts`
Expected: PASS. If a test fails, `period.elapsed` or `period.length` differs from `elapsedDays` or `cycleLength` for that case. Read both in `@saldo/core` and make `periodProjection` match `PeriodView`, not the other way round.

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error. Remove an import that is no longer used if Biome or `tsc` says so.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/web/src/features/stats/statsView.ts
rtk git commit -m "refactor(web): the end-of-period projection as its own function"
```

---

### Task 3: `expensesChartView` (W6)

**Files:**
- Create: `apps/web/src/features/stats/expensesChart.ts`
- Test: `apps/web/src/features/stats/expensesChart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/stats/expensesChart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { expensesChartView } from './expensesChart';
import type { NavigatorColumn } from './navigatorView';

/** A column of the navigator with only what the chart reads. */
function column(kind: NavigatorColumn['kind'], expenses: number, month: number): NavigatorColumn {
  const mm = String(month).padStart(2, '0');
  return {
    range: { start: `2026-${mm}-01`, end: `2026-${mm}-28` },
    kind,
    selected: false,
    running: kind === 'current',
    values: { income: 0, expenses },
    net: -expenses,
    forecast: null,
  };
}

const CLOSED = [100, 300, 200, 400, 500, 600].map((amount, index) =>
  column('closed', amount, index + 1),
);

describe('expensesChartView', () => {
  it('reads «usual» as the median of the closed bars only, rounded to the minor unit', () => {
    const view = expensesChartView({
      columns: [...CLOSED, column('current', 9000, 7), column('forecast', 9000, 8)],
      projection: null,
    });
    // 100 200 300 400 500 600 → (300 + 400) / 2; the current and the forecast bars do not count.
    expect(view.usual).toBe(350);

    const odd = expensesChartView({
      columns: [column('closed', 101, 1), column('closed', 200, 2)],
      projection: null,
    });
    expect(odd.usual).toBe(151);
  });

  it('scales every bar on the largest of the amounts, the projection and «usual»', () => {
    const view = expensesChartView({
      columns: [...CLOSED, column('current', 300, 7)],
      projection: 1200,
    });
    // The projection, 1200, is the top of the chart.
    expect(view.bars.map((bar) => bar.height)).toEqual([
      100 / 1200,
      300 / 1200,
      200 / 1200,
      400 / 1200,
      500 / 1200,
      600 / 1200,
      300 / 1200,
    ]);
    expect(view.usualHeight).toBe(350 / 1200);
  });

  it('puts the projection on the current bar only, never below what was spent', () => {
    const view = expensesChartView({
      columns: [column('closed', 400, 1), column('current', 300, 2), column('forecast', 200, 3)],
      projection: 250,
    });
    expect(view.bars.map((bar) => bar.projectionHeight)).toEqual([null, 300 / 400, null]);
  });

  it('draws flat bars when nothing was spent', () => {
    const view = expensesChartView({
      columns: [column('closed', 0, 1), column('current', 0, 2)],
      projection: null,
    });
    expect(view.bars.map((bar) => bar.height)).toEqual([0, 0]);
    expect(view.usual).toBe(0);
    expect(view.usualHeight).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `rtk proxy pnpm --filter web exec vitest run src/features/stats/expensesChart.test.ts`
Expected: FAIL, because `./expensesChart` does not exist.

- [ ] **Step 3: Write the function**

Create `apps/web/src/features/stats/expensesChart.ts`:

```ts
import { median } from '@saldo/core';
import type { NavigatorColumn } from './navigatorView';

export interface ExpensesChartBar {
  column: NavigatorColumn;
  amount: number;
  /** 0–1 of the chart's height. */
  height: number;
  /**
   * The running period's projection, as a height: the outlined part above what was spent (W6).
   * Never below `height`. `null` on every other bar, and when there is no projection.
   */
  projectionHeight: number | null;
}

export interface ExpensesChartView {
  bars: ExpensesChartBar[];
  /** The median of the closed bars, in minor units; `null` with no closed bar. */
  usual: number | null;
  usualHeight: number | null;
}

/**
 * W6: «Expenses by period» — one bar for each column of the navigator (the closed periods, the
 * running one, the forecast ones) and a dashed line for «usual», the median of the closed bars.
 * The chart is scaled on the largest of the amounts, the projection and «usual», so all three fit.
 */
export function expensesChartView(input: {
  columns: readonly NavigatorColumn[];
  /** `periodProjection` of the running period. */
  projection: number | null;
}): ExpensesChartView {
  const { columns, projection } = input;
  const middle = median(
    columns.filter((column) => column.kind === 'closed').map((column) => column.values.expenses),
  );
  const usual = middle === null ? null : Math.round(middle);
  const top = Math.max(
    0,
    ...columns.map((column) => column.values.expenses),
    projection ?? 0,
    usual ?? 0,
  );
  const ratio = (value: number) => (top === 0 ? 0 : value / top);
  return {
    bars: columns.map((column) => ({
      column,
      amount: column.values.expenses,
      height: ratio(column.values.expenses),
      projectionHeight:
        column.kind === 'current' && projection !== null
          ? ratio(Math.max(projection, column.values.expenses))
          : null,
    })),
    usual,
    usualHeight: usual === null ? null : ratio(usual),
  };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `rtk proxy pnpm --filter web exec vitest run src/features/stats/expensesChart.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/web/src/features/stats/expensesChart.ts apps/web/src/features/stats/expensesChart.test.ts
rtk git commit -m "feat(web): the bars and the usual line of the expenses chart (W6)"
```

---

### Task 4: `ExpensesChart` and `PeriodKeys`

**Files:**
- Create: `apps/web/src/ui/charts/ExpensesChart.tsx`
- Create: `apps/web/src/ui/charts/ExpensesChart.module.css`
- Create: `apps/web/src/ui/PeriodKeys.tsx`

No unit test: a component with no logic of its own. Task 6 covers both with Playwright.

- [ ] **Step 1: Write the chart**

Create `apps/web/src/ui/charts/ExpensesChart.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { AppLink as Link } from '../AppLink';
import styles from './ExpensesChart.module.css';

export interface ExpensesChartBar {
  key: string;
  /** The page of this period: the chart is the period picker (W6). */
  href: string;
  /** «Sep», under the bar. */
  tick: string;
  /** «1,366» under the tick; «~2,310» for a forecast period. Hidden below 760px. */
  value: string;
  /** The period and its amount, for the tooltip and a screen reader. */
  label: string;
  /** A forecast period's min–max, on a second line of the tooltip. */
  detail: string | null;
  kind: 'closed' | 'current' | 'forecast';
  selected: boolean;
  /** 0–1. */
  height: number;
  /** 0–1 and ≥ `height`: the running period's projection. */
  projectionHeight: number | null;
}

interface Props {
  bars: readonly ExpensesChartBar[];
  /** 0–1: the dashed line of «usual». */
  usualHeight: number | null;
}

/**
 * W6: one bar of expenses for each period and a dashed line for «usual». Each bar is a link to its
 * period, so the chart is the period picker. The running period fills what was spent and outlines
 * the projection above it; a forecast period is a light bar. The tooltip is CSS: it shows on hover
 * and on keyboard focus. A server component, with no state.
 */
export function ExpensesChart({ bars, usualHeight }: Props) {
  return (
    <div className={styles.cols}>
      {usualHeight === null ? null : (
        <span
          className={styles.usual}
          style={{ '--usual': usualHeight } as CSSProperties}
          aria-hidden="true"
        />
      )}
      {bars.map((bar) => (
        <Link
          key={bar.key}
          href={bar.href}
          className={`${styles.col} ${styles[bar.kind]}`}
          aria-current={bar.selected ? 'true' : undefined}
          aria-label={bar.detail === null ? bar.label : `${bar.label} · ${bar.detail}`}
        >
          <span className={styles.plot}>
            <span
              className={styles.bar}
              style={
                {
                  '--h': bar.height,
                  '--pj': bar.projectionHeight ?? bar.height,
                } as CSSProperties
              }
            >
              {bar.projectionHeight === null ? null : <span className={styles.projection} />}
              <span className={styles.spent} />
            </span>
            <span className={styles.tip} aria-hidden="true">
              <b>{bar.label}</b>
              {bar.detail}
            </span>
          </span>
          <span className={styles.tick} aria-hidden="true">
            <span className={styles.month}>{bar.tick}</span>
            <span className={styles.value}>{bar.value}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the chart CSS**

Create `apps/web/src/ui/charts/ExpensesChart.module.css`:

```css
/* W6: ten columns, one bar each; the dashed line of «usual» across them. */
.cols {
  --plot: 176px;
  --pad: 6px;
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  margin: 0 calc(var(--pad) * -1);
}

.col {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: var(--pad);
  border-radius: var(--radius-input);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-easing);
}

@media (hover: hover) and (pointer: fine) {
  .col:hover {
    background: var(--color-raised);
  }
}

.col[aria-current="true"] {
  background: var(--color-raised);
}

.col:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-text);
}

.plot {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: var(--plot);
}

.bar {
  display: flex;
  flex-direction: column;
  inline-size: min(28px, 62%);
  block-size: calc(max(var(--h), var(--pj)) * var(--plot));
  min-block-size: 2px;
  overflow: hidden;
  border-radius: var(--radius-icon-box) var(--radius-icon-box) 1px 1px;
}

.spent {
  flex: 1;
  background: var(--color-bar-grey);
}

.col[aria-current="true"] .spent {
  background: var(--color-text);
}

/* The running period: the projection above what was spent, as an outline. */
.projection {
  flex: none;
  block-size: calc((var(--pj) - var(--h)) * var(--plot));
  background: var(--color-track);
  box-shadow: inset 0 0 0 1px var(--color-border-strong);
}

/* A forecast period: a light bar. */
.forecast .spent {
  background: var(--color-track);
  box-shadow: inset 0 0 0 1px var(--color-border-strong);
}

.forecast[aria-current="true"] .spent {
  background: var(--color-bar-grey);
  box-shadow: none;
}

/* «Usual»: the median of the closed bars. */
.usual {
  position: absolute;
  inset-inline: var(--pad);
  top: calc(var(--pad) + (1 - var(--usual)) * var(--plot));
  z-index: 1;
  border-top: 1.5px dashed var(--color-text-muted);
  pointer-events: none;
}

.tick {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: var(--font-size-caption);
  white-space: nowrap;
}

.col[aria-current="true"] .tick {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.current .month {
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 4px;
}

.forecast .tick {
  color: var(--color-text-faint);
}

.value {
  font-weight: var(--font-weight-regular);
}

.tip {
  position: absolute;
  bottom: calc(100% - 4px);
  left: 50%;
  z-index: 3;
  padding: 7px 10px;
  border-radius: var(--radius-input);
  background: var(--color-text);
  color: var(--color-bg);
  font-size: var(--font-size-caption);
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 4px);
  transition:
    opacity var(--motion-press) var(--motion-easing),
    transform var(--motion-press) var(--motion-easing);
}

.tip b {
  display: block;
  font-weight: var(--font-weight-semibold);
}

.col:first-child .tip,
.usual + .col .tip {
  left: 0;
  transform: translate(0, 4px);
}

.col:last-child .tip {
  left: auto;
  right: 0;
  transform: translate(0, 4px);
}

@media (hover: hover) and (pointer: fine) {
  .col:hover .tip {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .col:first-child:hover .tip,
  .usual + .col:hover .tip,
  .col:last-child:hover .tip {
    transform: none;
  }
}

.col:focus-visible .tip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.col:first-child:focus-visible .tip,
.usual + .col:focus-visible .tip,
.col:last-child:focus-visible .tip {
  transform: none;
}

/* `--layout-shell-breakpoint` (760): the amounts do not show below it (W6). */
@media (max-width: 759px) {
  .cols {
    --plot: 140px;
    --pad: 3px;
  }

  .value {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tip {
    transition: opacity var(--motion-press) var(--motion-easing);
  }
}
```

- [ ] **Step 3: Write `PeriodKeys`**

Create `apps/web/src/ui/PeriodKeys.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ignoresShortcut } from './isEditable';
import { useNavTransition } from './NavPending';

interface Props {
  /** The previous period's page, or null at the first one the page reaches. */
  previousHref: string | null;
  nextHref: string | null;
}

/**
 * Statistics (W6, open item 4): ← and → select the previous and the next period. Not while the
 * focus is in a field, and not while a dialog, a menu or a form owns the keys (`ignoresShortcut`).
 */
export function PeriodKeys({ previousHref, nextHref }: Props) {
  const router = useRouter();
  const startNav = useNavTransition();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.shiftKey || ignoresShortcut(event)) return;
      if (document.querySelector('[role="dialog"][data-panel]') !== null) return;
      const href = event.key === 'ArrowLeft' ? previousHref : nextHref;
      if (href === null) return;
      event.preventDefault();
      startNav(() => router.push(href, { scroll: false }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, startNav, previousHref, nextHref]);
  return null;
}
```

The extra `[data-panel]` check is there because `ignoresShortcut` lets a `Panel` dialog through on purpose (R2 kept that for the list keys). On Statistics an open category dialog must keep ← and → away from the page.

- [ ] **Step 4: Typecheck**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Do not commit yet: Task 5 uses both, and they go in its commit.

---

### Task 5: The page (W6, W7, W8)

**Files:**
- Replace: `apps/web/app/(app)/stats/page.tsx`
- Replace: `apps/web/app/(app)/stats/stats.module.css`

The e2e tests read the page through these hooks. Keep them:
- **Figures:** each figure is a label in its own element, with the amount beside it in the same parent (`statFigure`).
- **Breakdown and Tags:** each block is a `section` whose `h2` is `stats.split` or `stats.tags` (`sectionOf`).
- **Breakdown rows:** each row is a link with `c=` in its `href` and the category name as an exact text (`cardOf`). The links «Expenses» and «Income» are inside the Breakdown section.
- **Running period:** it shows «so far» (`stats.soFar`).

- [ ] **Step 1: Find the previous and next period links**

Run: `rtk grep -n "previous\|next\|href" apps/web/src/ui/PeriodHeader.tsx`
Read how `PeriodHeader` builds its ‹ › links: which function it calls and with which reach. Step 2 calls the same function for `PeriodKeys`. If the hrefs come from a helper in `src/features/period/periodParams.ts` (for example `stepHref`), import it. If `PeriodHeader` builds them inline, move that code into an exported helper `periodStepHrefs(…)` in `periodParams.ts`. Make `PeriodHeader` call it too, so both use one rule. Write down the name you used, and use it in Step 2 in place of `periodStepHrefs`.

- [ ] **Step 2: Replace the page**

Replace the whole of `apps/web/app/(app)/stats/page.tsx` with the code below. If Step 1 gave the helper another name or signature, change the two lines marked `// Step 1`.

```tsx
import {
  formatCycleRange,
  formatLongDate,
  formatMajor,
  formatMoney,
  formatPeriodTick,
  formatSignedPercent,
  plural,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import type { ReactNode } from 'react';
import {
  PERIOD_PARAM,
  periodFromParam,
  periodHref,
  periodStepHrefs, // Step 1
} from '../../../src/features/period/periodParams';
import { expensesChartView } from '../../../src/features/stats/expensesChart';
import { forecastView } from '../../../src/features/stats/forecastView';
import { navigatorForecast, navigatorView } from '../../../src/features/stats/navigatorView';
import { periodProjection, statsView } from '../../../src/features/stats/statsView';
import { filtersFromSearch } from '../../../src/features/transactions/listParams';
import { listView } from '../../../src/features/transactions/listView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { Chip } from '../../../src/ui/Chip';
import { ChartFrame } from '../../../src/ui/charts/ChartFrame';
import { type ExpensesChartBar, ExpensesChart } from '../../../src/ui/charts/ExpensesChart';
import { Sparkline } from '../../../src/ui/charts/Sparkline';
import { SplitBar, type SplitSegment } from '../../../src/ui/charts/SplitBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { paletteIndex } from '../../../src/ui/IconBox';
import { ListRow } from '../../../src/ui/ListRow';
import { type PanelSpec, PanelSwitch } from '../../../src/ui/PanelSwitch';
import { PanelLink } from '../../../src/ui/PanelNav';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { PeriodKeys } from '../../../src/ui/PeriodKeys';
import { Section } from '../../../src/ui/Section';
import styles from './stats.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/stats';

/** Which direction the breakdown reads: «Expenses» and «Income», two tool buttons. */
const DIRECTION_PARAM = 'direction';

/** D8: a category row opens its dialog, `?c=`; the key is `c:{categoryId}`. */
const PANEL_PARAMS = { flags: [], values: ['c'] } as const;

/** How many of a category's transactions its dialog lists. */
const CATEGORY_ROWS = 5;

/** The name a category no longer in the list takes, as on the phone. */
const MISSING = '—';

/** W7: how many categories keep their own colour in the split bar; the rest share one grey. */
const SPLIT_COLOURS = 6;

const GREY = 'var(--color-bar-grey)';

/** A category colour as the CSS variable the root layout injects; grey for a row with none. */
function tint(colorIndex: number | null | undefined): string {
  return colorIndex === null || colorIndex === undefined
    ? GREY
    : `var(--category-${paletteIndex(colorIndex)})`;
}

/** A figure of the period block: the label, the amount, and an optional line under it. */
function Figure({
  label,
  note,
  hero = false,
  children,
}: {
  label: string;
  note?: string;
  hero?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={hero ? styles.hero : styles.figure}>
      <span className={styles.label}>{label}</span>
      {children}
      {note === undefined || note === '' ? null : <span className={styles.note}>{note}</span>}
    </div>
  );
}

/**
 * Statistics on the web (W6–W8): how this period compares with the others, and where the money
 * went. The period block holds the figures and «Expenses by period», which is the period picker.
 * A closed or running period then shows the breakdown and the tags; a forecast period shows the
 * recurring transactions it expects and the table of the forecast periods.
 *
 * Every figure is `statsView`, `navigatorView`, `forecastView` and `expensesChartView` — the same
 * `@saldo/core` the phone calls. Nothing is added up here.
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, params } = page;

  // The forecast first: how many periods `?p=` may reach ahead is how many forecast columns there
  // are, so the period cannot be read before it is known.
  const forecast = navigatorForecast({ data: page.data, def, today });
  const reach = forecast?.length ?? 0;
  const period = periodFromParam(def, today, params[PERIOD_PARAM], reach);
  const navigator = navigatorView({
    data: page.data,
    def,
    today,
    selected: period.range,
    forecast,
  });

  const direction = params[DIRECTION_PARAM] === 'income' ? 'income' : 'expense';
  // What every link on this page keeps. The period is not one of them: `periodHref` writes it.
  const keep: Record<string, string> =
    direction === 'income' ? { [DIRECTION_PARAM]: direction } : {};
  const directionHref = (which: 'expense' | 'income') =>
    periodHref(
      PATH,
      period.range,
      def,
      today,
      which === 'income' ? { [DIRECTION_PARAM]: which } : {},
    );
  const transactionsHref = (query: Record<string, string>) => {
    const search = new URLSearchParams(query);
    const p = params[PERIOD_PARAM];
    if (p !== undefined) search.set(PERIOD_PARAM, p);
    return `/transactions?${search.toString()}`;
  };
  const money = (minor: number) => formatMoney(minor, currency, locale);

  // ---- The chart (W6) -------------------------------------------------------------------------
  const running = navigator.columns.find((column) => column.kind === 'current');
  const chart = expensesChartView({
    columns: navigator.columns,
    projection:
      running === undefined
        ? null
        : periodProjection({ txs: page.data.transactions, def, range: running.range, today }),
  });
  const bars: ExpensesChartBar[] = chart.bars.map((bar) => {
    const { column } = bar;
    const forecastColumn = column.kind === 'forecast';
    const amount = formatMajor(bar.amount, currency, locale, 'never');
    const range = column.values.forecast;
    return {
      key: column.range.start,
      href: periodHref(PATH, column.range, def, today, keep),
      tick: formatPeriodTick(column.range.start, def.kind, locale),
      value: forecastColumn ? `~${amount}` : amount,
      label: `${formatCycleRange(column.range, locale, today)} · ${
        forecastColumn ? '~' : ''
      }${money(bar.amount)}`,
      detail:
        range === undefined
          ? null
          : t('stats.forecastRange', {
              min: formatMajor(range.min, currency, locale, 'never'),
              max: formatMajor(range.max, currency, locale, 'never'),
            }),
      kind: column.kind,
      selected: column.selected,
      height: bar.height,
      projectionHeight: bar.projectionHeight,
    };
  });
  const chartBlock = (
    <>
      <h2 className={styles.chartTitle}>{t('stats.expensesByPeriod')}</h2>
      <ExpensesChart bars={bars} usualHeight={chart.usualHeight} />
      {chart.usual === null ? null : (
        <p className={styles.chartFoot}>{t('stats.usualNote', { amount: money(chart.usual) })}</p>
      )}
    </>
  );

  const { previous: previousHref, next: nextHref } = periodStepHrefs(
    PATH,
    period,
    def,
    today,
    keep,
    reach,
  ); // Step 1
  const header = (
    <>
      <PeriodHeader
        period={period}
        def={def}
        today={today}
        locale={locale}
        path={PATH}
        params={keep}
        reach={reach}
        status={
          period.ahead > 0
            ? undefined
            : period.isCurrent
              ? t('period.inProgress', { elapsed: period.elapsed, length: period.length })
              : t('period.closed')
        }
        strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
      />
      <PeriodKeys previousHref={previousHref} nextHref={nextHref} />
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // A forecast period: what it expects, and the table of the periods ahead (§5.17).
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const selectedForecast = navigator.selected === null ? null : navigator.selected.forecast;
  if (period.ahead > 0 && forecast !== null && selectedForecast !== null) {
    const view = forecastView({
      recurrences: page.data.recurrences,
      periods: forecast,
      selected: selectedForecast,
    });
    const selected = view.selected;
    const categories = new Map(page.data.categories.map((category) => [category.id, category]));

    return (
      <div className={styles.page}>
        {header}
        <section className={styles.box} aria-label={t('stats.expensesByPeriod')}>
          <div className={styles.figures}>
            <Figure
              hero
              label={t('stats.expensesAbout')}
              note={t('stats.forecastRange', {
                min: formatMajor(selected.expensesMin, currency, locale, 'never'),
                max: formatMajor(selected.expensesMax, currency, locale, 'never'),
              })}
            >
              <AmountText minor={selected.expenses} currency={currency} locale={locale} size="hero" />
            </Figure>
            <div className={styles.stats}>
              <Figure label={t('stats.incomeAbout')} note={t('stats.fromRecurrences')}>
                <AmountText
                  minor={selected.income}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  positive
                />
              </Figure>
              <Figure label={t('stats.netAbout')}>
                <AmountText
                  minor={selected.income - selected.expenses}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  sign="always"
                />
              </Figure>
              <Figure
                label={t('stats.balanceAbout')}
                note={t('stats.atDate', { date: formatLongDate(selected.range.end, locale) })}
              >
                <AmountText
                  minor={selected.balance}
                  currency={currency}
                  locale={locale}
                  size="headline"
                />
              </Figure>
            </div>
          </div>
          {chartBlock}
        </section>

        <div className={styles.pair}>
          <section className={styles.box}>
            <div className={styles.boxHead}>
              <h2 className={styles.boxTitle}>{t('stats.forecastRecurrences')}</h2>
              <span className={styles.status}>{formatCycleRange(selected.range, locale, today)}</span>
            </div>
            {view.recurrences.length === 0 ? (
              <EmptyState title={t('stats.forecastNoRecurrences')} />
            ) : (
              view.recurrences.map((row) => {
                const category =
                  row.categoryId === null ? undefined : categories.get(row.categoryId);
                return (
                  <ListRow
                    key={row.recurrenceId}
                    open
                    icon={category?.icon as IconName | undefined}
                    colorIndex={category?.colorIndex}
                    title={row.description === '' ? (category?.name ?? MISSING) : row.description}
                    subtitle={
                      row.count > 1 ? plural(t, locale, 'stats.forecastTimes', row.count) : undefined
                    }
                    trailing={
                      <AmountText
                        minor={row.kind === 'income' ? row.total : -row.total}
                        currency={currency}
                        locale={locale}
                        sign="always"
                      />
                    }
                  />
                );
              })
            )}
          </section>

          <section className={styles.box}>
            <div className={styles.boxHead}>
              <h2 className={styles.boxTitle}>{t('stats.forecastPeriods')}</h2>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('stats.forecastColAt')}</th>
                  <th scope="col">{t('stats.expensesAbout')}</th>
                  <th scope="col" className={styles.rangeCol}>
                    {t('stats.forecastColRange')}
                  </th>
                  <th scope="col">{t('stats.balanceAbout')}</th>
                </tr>
              </thead>
              <tbody>
                {view.periods.map((entry) => (
                  <tr
                    key={entry.range.start}
                    className={
                      entry.range.start === selected.range.start ? styles.tableSelected : ''
                    }
                  >
                    <th scope="row">{formatLongDate(entry.range.end, locale)}</th>
                    <td>{money(entry.expenses)}</td>
                    <td className={`${styles.faint} ${styles.rangeCol}`}>
                      {t('stats.forecastRange', {
                        min: formatMajor(entry.expensesMin, currency, locale, 'never'),
                        max: formatMajor(entry.expensesMax, currency, locale, 'never'),
                      })}
                    </td>
                    <td>{money(entry.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* «How it's calculated» is a line at the bottom of «Forecast periods». */}
            <p className={styles.foot}>
              <b>{t('stats.forecastHowTitle')}</b> {t('stats.forecastHow')}
            </p>
          </section>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // A running or closed period: the period block, the breakdown, the tags.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const view = statsView({ data: page.data, def, today, period, direction });
  const tagNames = new Map(page.data.tags.map((tag) => [tag.id, tag.name]));
  const anyTagIncome = view.tags.tags.some((row) => row.income > 0);

  // W7: each row in the colour of its category; past the sixth, the bar shares one grey segment.
  const ranked = view.split.rows.map((row) => ({ row, colour: tint(row.category?.colorIndex) }));
  const segments: SplitSegment[] = [
    ...ranked.slice(0, SPLIT_COLOURS).map(({ row, colour }) => ({
      key: row.categoryId,
      amount: row.amount,
      colour,
    })),
    {
      key: 'other',
      amount: ranked.slice(SPLIT_COLOURS).reduce((sum, { row }) => sum + row.amount, 0),
      colour: GREY,
    },
  ];

  const projection = view.figures.projection;
  const median = view.figures.median;
  // Under Expenses: «so far» while the period runs, and how a closed one sat against the median.
  const spentNote =
    period.isCurrent || median === null
      ? period.isCurrent
        ? t('stats.soFar')
        : undefined
      : t(view.figures.spent >= median ? 'stats.aboveMedian' : 'stats.belowMedian', {
          amount: money(Math.abs(view.figures.spent - median)),
        });
  const projectionNote =
    projection === null || chart.usual === null
      ? undefined
      : t(projection >= chart.usual ? 'stats.projectionAboveShort' : 'stats.projectionBelowShort', {
          amount: money(Math.abs(projection - chart.usual)),
        });

  const baseHref = periodHref(PATH, period.range, def, today, keep);
  const categoryHref = (categoryId: string) =>
    periodHref(PATH, period.range, def, today, { ...keep, c: categoryId });
  const deltaText = (delta: number | null) =>
    delta === null ? t('stats.newLabel') : t('stats.vsUsual', { delta: formatSignedPercent(delta) });

  // Every category's dialog, rendered here: a click only chooses one (`PanelSwitch`).
  const panels: Record<string, PanelSpec> = {};
  for (const { row } of ranked) {
    const rows = listView({
      data: page.data,
      filters: filtersFromSearch({ category: row.categoryId, direction }),
      today,
      period,
      kindLabel: (kind) => t(`kinds.${kind}`),
    })
      .days.flatMap((day) => day.rows)
      .slice(0, CATEGORY_ROWS);
    panels[`c:${row.categoryId}`] = {
      title: row.category?.name ?? MISSING,
      body: (
        <>
          <Figure
            label={direction === 'income' ? t('stats.income') : t('stats.expenses')}
            note={[t('stats.ofTotal', { pct: row.share }), deltaText(row.delta)].join(' · ')}
          >
            <AmountText
              minor={row.amount}
              currency={currency}
              locale={locale}
              size="large"
              positive={direction === 'income'}
            />
          </Figure>
          <ChartFrame title={plural(t, locale, 'stats.lastPeriods', row.history.length)}>
            <Sparkline series={row.history} height={56} />
          </ChartFrame>
          <Section
            open
            title={t('tabs.transactions')}
            more={
              <Link className={styles.more} href={transactionsHref({ category: row.categoryId })}>
                <span>{t('home.allTransactions')}</span>
                <Icon name="chevR" size={16} />
              </Link>
            }
          >
            {rows.length === 0 ? (
              <EmptyState title={t('stats.empty')} />
            ) : (
              rows.map((tx) => (
                <ListRow
                  key={tx.id}
                  open
                  href={`/transactions?t=${tx.id}`}
                  icon={tx.icon as IconName}
                  colorIndex={tx.colorIndex}
                  title={tx.title}
                  subtitle={tx.subtitle}
                  trailing={
                    <AmountText
                      minor={tx.amount.minor}
                      currency={currency}
                      locale={locale}
                      sign={tx.amount.signDisplay}
                    />
                  }
                />
              ))
            )}
          </Section>
        </>
      ),
    };
  }

  return (
    <PanelSwitch
      baseHref={baseHref}
      params={PANEL_PARAMS}
      panels={panels}
      closeLabel={t('common.close')}
    >
      <div className={styles.page}>
        {header}

        {/* The period block: Expenses, then Income, Net and the projection; the chart under them. */}
        <section className={styles.box} aria-label={t('stats.expensesByPeriod')}>
          <div className={styles.figures}>
            <Figure hero label={t('stats.expenses')} note={spentNote}>
              <AmountText minor={view.figures.spent} currency={currency} locale={locale} size="hero" />
            </Figure>
            <div className={styles.stats}>
              <Figure label={t('stats.income')}>
                <AmountText
                  minor={view.figures.income}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  positive
                />
              </Figure>
              <Figure label={t('stats.net')}>
                <AmountText
                  minor={view.figures.net}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  sign="always"
                />
              </Figure>
              {projection === null ? null : (
                <Figure label={t('stats.projection')} note={projectionNote}>
                  <AmountText
                    minor={projection}
                    currency={currency}
                    locale={locale}
                    size="headline"
                  />
                </Figure>
              )}
            </div>
          </div>
          {chartBlock}
        </section>

        {/* W7: the breakdown, in the colours of the categories. */}
        <section className={styles.box}>
          <div className={styles.boxHead}>
            <h2 className={styles.boxTitle}>{t('stats.split')}</h2>
            <span className={styles.toggle}>
              <Chip
                label={t('stats.expenses')}
                href={directionHref('expense')}
                active={direction === 'expense'}
              />
              <Chip
                label={t('stats.income')}
                href={directionHref('income')}
                active={direction === 'income'}
              />
            </span>
          </div>
          {view.split.rows.length === 0 ? (
            <EmptyState title={t('stats.empty')} />
          ) : (
            <>
              <SplitBar segments={segments} />
              <div className={styles.cats}>
                {ranked.map(({ row, colour }) => (
                  <PanelLink
                    key={row.categoryId}
                    className={styles.cat}
                    selectedClassName={styles.catSelected}
                    selectId={`c:${row.categoryId}`}
                    href={categoryHref(row.categoryId)}
                  >
                    <span className={styles.catIcon} style={{ color: colour }}>
                      {row.category === undefined ? null : (
                        <Icon name={row.category.icon as IconName} size={18} />
                      )}
                    </span>
                    <span className={styles.catName}>{row.category?.name ?? MISSING}</span>
                    <span className={styles.catShare}>
                      <span className={styles.track}>
                        <span style={{ width: `${row.share}%`, background: colour }} />
                      </span>
                      <span>{t('targets.percent', { value: row.share })}</span>
                    </span>
                    <span className={styles.catDelta}>{deltaText(row.delta)}</span>
                    <span className={styles.catAmount}>
                      <AmountText minor={row.amount} currency={currency} locale={locale} />
                    </span>
                  </PanelLink>
                ))}
              </div>
            </>
          )}
          {view.split.excluded.count === 0 ? null : (
            <p className={styles.note}>
              {plural(t, locale, 'stats.excludedRow', view.split.excluded.count, {
                amount: money(view.split.excluded.amount),
              })}
            </p>
          )}
          {/* «Committed share» is a line at the bottom of the block. */}
          {direction === 'expense' && view.split.rows.length > 0 ? (
            <p className={styles.foot}>
              <b>{t('stats.committed')}</b>{' '}
              {t('stats.committedLine', {
                pct: view.committed.share,
                amount: money(view.committed.amount),
              })}
            </p>
          ) : null}
        </section>

        <section className={styles.box}>
          <div className={styles.boxHead}>
            <h2 className={styles.boxTitle}>{t('stats.tags')}</h2>
            <span className={styles.status}>
              {anyTagIncome ? t('stats.tagsFlows') : t('stats.expenses')}
            </span>
          </div>
          {view.tags.tags.length === 0 ? (
            <EmptyState title={t('stats.tagsEmpty')} />
          ) : (
            view.tags.tags.map((row) => (
              <ListRow
                key={row.tagId}
                open
                title={tagNames.get(row.tagId) ?? row.tagId}
                subtitle={plural(t, locale, 'tags.uses', row.count)}
                href={transactionsHref({ tag: row.tagId })}
                trailing={
                  <span className={styles.tagAmounts}>
                    {/* A tag that only brought money in has no spend worth a «0,00» above it. */}
                    {row.expense === 0 && row.income > 0 ? null : (
                      <AmountText minor={row.expense} currency={currency} locale={locale} />
                    )}
                    {row.income === 0 ? null : (
                      <AmountText
                        minor={row.income}
                        currency={currency}
                        locale={locale}
                        size="footnote"
                        sign="always"
                      />
                    )}
                  </span>
                }
              />
            ))
          )}
          {view.tags.untaggedCount === 0 ? null : (
            <p className={styles.note}>
              {plural(t, locale, 'stats.tagsUntagged', view.tags.untaggedCount, {
                amount: money(view.tags.untagged),
              })}
            </p>
          )}
          {view.tags.tags.length < 2 ? null : (
            <p className={styles.footnote}>{t('stats.tagsOverlap')}</p>
          )}
        </section>
      </div>
    </PanelSwitch>
  );
}
```

Note on the old page: it did not pass `money()` to the forecast table. It called `formatMoney` with the same arguments, so the output is the same.

- [ ] **Step 3: Replace the page CSS**

Replace the whole of `apps/web/app/(app)/stats/stats.module.css` with:

```css
/* W6–W8: the period block, the breakdown, the tags — plain blocks in the column (H3). */
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-bg);
}

.boxHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.boxTitle {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
}

/* The figures: Expenses large, then a row of the others. */
.figures {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 12px;
}

.hero,
.figure {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  gap: 16px 32px;
}

.label {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
}

.note {
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  text-wrap: pretty;
  max-width: 52ch;
}

.footnote {
  font-size: var(--font-size-caption);
  color: var(--color-text-faint);
  text-wrap: pretty;
  max-width: 52ch;
}

.chartTitle {
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.chartFoot {
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

/* A line at the bottom of a block: «Committed share», «How it's calculated». */
.foot {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);
  font-size: var(--font-size-footnote);
  color: var(--color-text-muted);
  text-wrap: pretty;
}

.foot b {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.status {
  font-size: var(--font-size-footnote);
  color: var(--color-text-faint);
  white-space: nowrap;
}

.toggle {
  display: inline-flex;
  gap: 6px;
}

/* W7: one row for each category — icon, name, share bar, change against usual, amount. */
.cats {
  display: flex;
  flex-direction: column;
}

.cat {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) minmax(0, 220px) 96px 104px;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 0 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-easing);
}

@media (hover: hover) and (pointer: fine) {
  .cat:hover {
    background: var(--color-raised);
  }
}

.cat:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-text);
}

.catSelected {
  background: var(--color-raised);
}

.catIcon {
  display: grid;
  place-items: center;
}

.catName {
  min-width: 0;
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.catShare {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.catShare > :last-child {
  width: 34px;
  text-align: end;
}

.track {
  flex: 1;
  height: 4px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-track);
}

.track > span {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
}

.catDelta {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
  white-space: nowrap;
}

.catAmount {
  text-align: end;
  white-space: nowrap;
}

.tagAmounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

/* A forecast period: two blocks side by side on a wide screen. */
.pair {
  display: grid;
  gap: 16px;
}

/* `--layout-wide-breakpoint` (1024): a media query cannot read a custom property. */
@media (min-width: 1024px) {
  .pair {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-footnote);
}

.table th,
.table td {
  padding: 8px 0;
  text-align: start;
  font-weight: var(--font-weight-regular);
  border-bottom: 1px solid var(--color-border);
}

.table thead th {
  color: var(--color-text-muted);
}

.table td:not(:first-child),
.table th:not(:first-child) {
  text-align: end;
}

.tableSelected th,
.tableSelected td {
  font-weight: var(--font-weight-semibold);
}

.faint {
  color: var(--color-text-faint);
}

/* `--layout-shell-breakpoint` (760): a media query cannot read a custom property. */
@media (max-width: 759px) {
  .box {
    padding: 18px;
  }

  .stats {
    grid-template-columns: repeat(2, auto);
  }

  .cat {
    grid-template-columns: 20px minmax(0, 1fr) auto;
  }

  .catShare,
  .catDelta {
    display: none;
  }

  .rangeCol {
    display: none;
  }
}
```

Before you replace the file, read the old `stats.module.css` to its end. If it has a rule this page still uses that the new file lacks (for example `.sticky`, `.percent`), add that rule back only if the new `page.tsx` uses the class.

- [ ] **Step 4: Delete what nothing uses**

Run: `rtk grep -rln "CashflowChart\|TrendChart\|ui/Columns" apps/web/app apps/web/src`
Expected: only the files of those components. Then delete:

```bash
rtk git rm apps/web/src/ui/charts/CashflowChart.tsx apps/web/src/ui/charts/CashflowChart.module.css apps/web/src/ui/charts/TrendChart.tsx apps/web/src/ui/charts/TrendChart.module.css
```

If `src/ui/Columns.tsx` (and its CSS) has no other user, delete them too. Keep `ChartFrame`, `Sparkline`, `HeroBand` and `PageHead`, which Accounts and the category dialog still use. If a comment in `Sparkline.tsx` names `TrendChart`, change it to name `TrendScrub`.

- [ ] **Step 5: Lint, typecheck and test**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no error.

Run: `rtk proxy pnpm --filter web test`
Expected: PASS.

- [ ] **Step 6: Look at the page**

Run: `rtk proxy pnpm --filter web dev`. Sign in with a seeded user. Use a temporary Playwright screenshot script if you have no browser, and delete it before you commit. Look at these four pages:
- `/stats`, the current period.
- `/stats?p=` the previous month, a closed period.
- `/stats?p=` the first forecast month: click the first light bar.
- `/stats?direction=income`.

Do each at 1440px and at 390px, in the light and the dark theme.

Expected:
- **Period block:** Expenses large, then Income, Net and Projection (projection in the current period only).
- **Chart:**
  - 10 bars; the selected bar is dark.
  - The current bar has an outlined projection above it, and its month is underlined.
  - The forecast bars are light, with «~» before the amount.
  - The dashed line sits at the height of the line under the chart.
  - At 390px the amounts under the months do not show.
- **Breakdown:** the split bar and the share bars use the colour of each category. «Committed share» is the last line of the block.
- **Forecast period:** «Expected recurring transactions» and «Forecast periods» show; Breakdown and Tags do not.
- **Keys:** ← and → change the period. They do nothing while the category dialog is open.
- **Overflow:** nothing overflows at 390px.

- [ ] **Step 7: Commit**

```bash
rtk git add "apps/web/app/(app)/stats" apps/web/src/ui/charts apps/web/src/ui/PeriodKeys.tsx apps/web/src/ui/PeriodHeader.tsx apps/web/src/features/period apps/web/src/ui
rtk git commit -m "feat(web): Statistics as the period block, the breakdown and the tags (W6–W8)"
```

---

### Task 6: e2e

**Files:**
- Modify: `apps/web/e2e/home-stats.spec.ts`

- [ ] **Step 1: Run the Statistics tests as they are**

Run: `rtk proxy pnpm --filter web e2e -- home-stats.spec.ts`
Expected: they pass. They read the figures, the rows of the breakdown, the tags and the dialog, and Task 5 kept those hooks. If one fails, read why. Fix the page when it broke a rule of the spec. Fix the test when it only looked for the old markup.

- [ ] **Step 2: Add a test for the chart and the keys**

In `test.describe('Statistiche', …)`, after the test `'‹ moves the figures and the title to the previous period'`, add:

```ts
  test('a bar of the chart selects its period, and ← → move it (W6)', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Grafico',
      email: 'stats-chart@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const current = monthOf(ledger.today);
    const closed = previousMonth(current);
    const title = (range: { end: string }) => upperFirst(formatMonthLong(range.end, lang));

    await page.goto('/stats');
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    const block = page.getByRole('region', { name: t('stats.expensesByPeriod') });
    // «Usual» is said in words under the chart.
    await expect(block).toContainText(
      t('stats.usualNote', { amount: 'X' }).split('X')[0]?.trim() ?? '',
    );

    // Six closed bars, then the running one, which is selected. Each bar is a link to its period.
    const bars = block.getByRole('link');
    await expect(bars.nth(6)).toHaveAttribute('aria-current', 'true');
    await bars.nth(5).click();
    await expect(page.getByText(title(closed), { exact: true })).toBeVisible();
    await expect(bars.nth(5)).toHaveAttribute('aria-current', 'true');
    await expect(block.locator('a[aria-current="true"]')).toHaveCount(1);

    // → goes back to the current month, ← to the previous one.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText(title(closed), { exact: true })).toBeVisible();
    await member.context.close();
  });
```

Make sure that `upperFirst`, `formatMonthLong`, `monthOf`, `previousMonth`, `appLocale`, `readLedger` and `createMember` are already imported in the file: the test `'‹ moves the figures…'` uses all of them.

- [ ] **Step 3: Run the suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: every test passes.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/e2e
rtk git commit -m "test(web): the expenses chart selects a period, and the arrow keys move it (W6)"
```

---

### Task 7: Roadmap and gates

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Tick R4**

In `docs/superpowers/plans/README.md`, replace:

```markdown
- [ ] **R4** — Statistics (W6–W8).
```

with:

```markdown
- [x] **R4** — Statistics (W6–W8) (`plans/2026-10-21-web-redesign-r4-stats.md`).
```

After the paragraph `**Acceptance for R3:** …`, add:

```markdown
**Acceptance for R4:** Statistics shows the period block (Expenses, Income, Net, projection, and
«Expenses by period» with one bar for each period and a dashed «usual» line), the breakdown in the
colours of the categories with share bars and «Committed share» as its last line, and the tags; a
bar and ← → select the period; a forecast period shows its recurring transactions and the forecast
table; the period trend is gone from the page.
```

- [ ] **Step 2: Run the gates, unfiltered**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `rtk proxy pnpm typecheck --continue`
Expected: every package passes. On a machine with Node older than 22.22, `site` fails on the engine check only; that is not a failure of this plan.

Run: `rtk proxy pnpm test`
Expected: every package passes.

- [ ] **Step 3: Commit**

```bash
rtk git add docs/superpowers/plans/README.md
rtk git commit -m "docs: the web redesign in the roadmap, R4 done"
```
