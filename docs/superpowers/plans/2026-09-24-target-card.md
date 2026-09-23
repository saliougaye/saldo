# Target card (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home budget card ("top 3 by ratio") with the target card of spec §5.13 (D25): one featured budget with a sentence that says what to do, over-limit budgets as rows, everything else behind one «Tutti i budget» row of rings.

**Architecture:** The ranking (tiers + hysteresis), the event rows, the header status and the sentence are pure functions in `@saldo/core` (`targets.ts`, `budgetTargets.ts`), unit-tested with Vitest. The mobile app gets three presentational pieces built to be reused by Plan B (goals): `TargetRing`, `FeaturedTarget` and `SeeAllRow`. `HomeBudgetCard` only maps `BudgetView`s onto them and remembers the featured id device-locally (`kv`).

**Tech Stack:** TypeScript strict, Vitest (`@saldo/core`, `@saldo/ui`, `@saldo/i18n`), jest-expo + React Native Testing Library (`mobile`), `react-native-svg`, `react-i18next` (`Trans`), Expo Router.

**Scope:** Plan A only. Goals, pockets and the Obiettivi card are Plan B (ROADMAP 0.1 «Goals»). Budget rules (§5.8: range, spent, rollover, alerts) do not change.

**Found while planning, fixed here (Task 9):** `app/budgets.tsx` draws the pace tick at `view.spent / limitWithCarry` — the budget's own ratio, so the tick always sits at the end of the fill (visible in `docs/screenshots/budgets.png`). `BudgetView` gains a real `pace` in Task 4, and the list uses it.

**Decisions recorded here (AGENTS.md "spec silent → note it in the plan"):**

- **Hidden mode leaves the Home target cards alone.** The hidden-mode plan narrowed Home to the «Rimasto da spendere» card on the third device check (2026-09-22); the budget card has stayed visible since. The first draft of §5.13 said the opposite; Task 1 corrects the spec.
- **Rings animate a change of value, never their arrival** (decided with the animation framework, 2026-09-24). Home is opened tens of times a day and its cards already fade in, so a ring filling on every open is noise; a ring moving from its old value to its new one after a new expense is feedback on a state change. Same rule, curve and duration as `ProgressBar`: start at the current value, `withTiming` to the next (`motion.progressMs`, `EASE`, interruptible), instant under Reduce Motion. The pace tick and a change of featured item do not animate. `strokeDashoffset` through `useAnimatedProps` runs on the UI thread and costs no layout, so `theme/motion.ts`'s rule is restated as "nothing that costs layout per frame" (Task 7). Task 1 records it in the spec.
- **Per day is rounded down** (`Math.floor`): the advice is a ceiling, and rounding up would let the last day overshoot the limit.
- **The sentence's action is bold through `Trans`** (`<b>…</b>` in the catalog), so translators move the emphasis with the words.
- **The empty card keeps its header static** and gains the row «Crea un budget» → `/budgets`, where the dashed «Nuovo budget» lives (§6.4).
- **The previous featured id lives in `kv`** under `home.featuredBudget`; a stale id (budget deleted, data wiped) is simply not found and ignored.

---

## File structure

| File | Responsibility |
| --- | --- |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` | Modify: §5.13 hidden mode, motion, per-day rounding |
| `packages/ui/src/tokens.ts` / `tokens.test.ts` | Modify: `layout.progressHeightThick`, `paceTickOverhangThick`, `targetRing`, `targetRingSmall` |
| `packages/core/src/targets.ts` / `.test.ts` | Create: `RankedTarget`, `featuredTarget` (tiers + hysteresis), `MAX_TARGET_EVENTS`, `FEATURE_MARGIN` |
| `packages/core/src/budgetTargets.ts` / `.test.ts` | Create: `rankBudget`, `budgetEventIds`, `budgetCardStatus`, `budgetAdvice` |
| `packages/core/src/index.ts` | Modify: export the two modules |
| `apps/mobile/src/features/budgets/useBudgetProgress.ts` / `.test.ts` | Modify: `BudgetView.pace` |
| `apps/mobile/src/components/ProgressBar.tsx` | Modify: `thick` prop (8pt, tick overhang 4) |
| `apps/mobile/src/components/ringGeometry.ts` / `.test.ts` | Create: pure ring maths |
| `apps/mobile/src/components/TargetRing.tsx` / `.test.tsx` | Create: ring + icon, decorative for a11y, animates value changes |
| `apps/mobile/src/theme/motion.ts` | Modify: restate the motion rule (no layout per frame) |
| `packages/i18n/src/locales/{it,en,fr,de,sv,es,pt}.ts` | Modify: `targets` namespace |
| `apps/mobile/src/features/targets/endLabels.ts` / `.test.ts` | Create: which bar labels show |
| `apps/mobile/src/features/targets/FeaturedTarget.tsx` | Create: the featured block |
| `apps/mobile/src/features/targets/SeeAllRow.tsx` | Create: the «Tutti …» row with rings |
| `apps/mobile/src/features/budgets/HomeBudgetCard.tsx` / `.test.tsx` | Rewrite on the target card |
| `apps/mobile/app/budgets.tsx` | Modify: `open` route param, real pace tick |

---

### Task 1: Correct §5.13 before building on it

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` (§5.13)

- [ ] **Step 1: Replace the hidden-mode and motion bullets of §5.13**

Find:

```markdown
- **Hidden mode:** every amount masks (the big figure, the sentence, statuses that carry money), `pct` hides, bars and
  rings empty, as `ProgressBar` does.
- **Motion:** Home is seen every day, so nothing animates in. Ring fills follow the progress-bar rule
  (`motion.progressMs`, the shared easing, instant under Reduce Motion), on `strokeDashoffset`. Rows keep the usual
  press feedback.
```

Replace with:

```markdown
- **Hidden mode leaves the Home target cards alone**, as it left the Home budget card since the third device check of
  hidden mode (2026-09-22): on Home only «Rimasto da spendere» hides. The goal list and detail (§6.35, §6.36) follow the
  aggregate rule like any balance.
- **Motion:** nothing animates in beyond Home's card entrance: Home is opened tens of times a day. A **change of
  value** animates — the featured bar (`ProgressBar`, `scaleX`) and every ring (`strokeDashoffset` through
  `useAnimatedProps`, on the UI thread, no layout) move from the old value to the new one, `motion.progressMs` with the
  shared easing, interruptible, instant under Reduce Motion. The pace tick and a change of featured item do not
  animate. Rows keep the usual press feedback.
```

- [ ] **Step 2: Say how the per-day amount rounds**

Find:

```markdown
     sotto} il ritmo.» `daysLeft` counts today and the range's last day.
```

Replace with:

```markdown
     sotto} il ritmo.» `daysLeft` counts today and the range's last day; the amount per day is rounded **down**, since
     it is a ceiling and rounding up would let the last day overshoot.
```

- [ ] **Step 3: Commit**

```bash
rtk git add docs/superpowers/specs/2026-09-10-saldo-poc-spec.md
rtk git commit -m "docs(spec): target cards keep hidden mode's Home scope, animate changes only"
```

---

### Task 2: Layout tokens for the thick bar and the rings

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `layout` object)
- Test: `packages/ui/src/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/ui/src/tokens.test.ts`:

```ts
describe('target card layout', () => {
  it('draws the featured bar twice as thick as a row bar, with a longer pace tick', () => {
    expect(layout.progressHeightThick).toBe(layout.progressHeight * 2);
    expect(layout.paceTickOverhangThick).toBeGreaterThan(layout.paceTickOverhang);
  });

  it('sizes the event-row ring like an icon box and the preview ring smaller', () => {
    expect(layout.targetRing).toBeGreaterThanOrEqual(layout.iconBox);
    expect(layout.targetRingSmall).toBeLessThan(layout.targetRing);
  });
});
```

(`layout` is already imported at the top of the file.)

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: FAIL — `expected undefined to be 8`.

- [ ] **Step 3: Add the tokens**

In `packages/ui/src/tokens.ts`, inside `export const layout = {`, after `paceTickOverhang: 3,`:

```ts
  /** The featured item of a target card (§5.13): twice a row's bar, with a longer pace tick. */
  progressHeightThick: 8,
  paceTickOverhangThick: 4,
  /** Progress rings of a target card: an event row's (icon box size) and the «Tutti …» preview. */
  targetRing: 36,
  targetRingSmall: 28,
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
rtk git commit -m "feat(ui): layout tokens for target cards"
```

---

### Task 3: `featuredTarget` — tiers and hysteresis

**Files:**
- Create: `packages/core/src/targets.ts`
- Test: `packages/core/src/targets.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/targets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { featuredTarget, type RankedTarget } from './targets';

const item = (id: string, tier: number, score: number, margin = 0.05): RankedTarget => ({
  id,
  tier,
  score,
  margin,
});

describe('featuredTarget', () => {
  it('features nothing when there is nothing', () => {
    expect(featuredTarget([], null)).toBeNull();
  });

  it('lets a higher tier win whatever the scores', () => {
    expect(featuredTarget([item('a', 0, 9), item('b', 1, 0.01)], null)).toBe('b');
  });

  it('ranks inside a tier by score', () => {
    expect(featuredTarget([item('a', 1, 0.1), item('b', 1, 0.3), item('c', 1, 0.2)], null)).toBe(
      'b',
    );
  });

  it('keeps the previous item while a rival in its tier is within the margin', () => {
    expect(featuredTarget([item('a', 1, 0.12), item('b', 1, 0.1)], 'b')).toBe('b');
  });

  it('hands over once a rival in the same tier beats the margin', () => {
    expect(featuredTarget([item('a', 1, 0.2), item('b', 1, 0.1)], 'b')).toBe('a');
  });

  it('hands over at once to a higher tier', () => {
    expect(featuredTarget([item('a', 2, 1), item('b', 1, 0.9)], 'b')).toBe('a');
  });

  it('ignores a previous id that is no longer among the items', () => {
    expect(featuredTarget([item('a', 0, 0.4)], 'gone')).toBe('a');
  });

  it('measures the margin in the previous item’s own units', () => {
    // Money scores: 5% of a 420,00 € limit is 2100 minor units.
    expect(featuredTarget([item('a', 2, 3000, 2000), item('b', 2, 1080, 2100)], 'b')).toBe('b');
    expect(featuredTarget([item('a', 2, 3500, 2000), item('b', 2, 1080, 2100)], 'b')).toBe('a');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- targets`
Expected: FAIL — `Cannot find module './targets'`.

- [ ] **Step 3: Implement**

Create `packages/core/src/targets.ts`:

```ts
/**
 * Target cards (§5.13): Budget and Obiettivi on Home feature one item each. The caller ranks its
 * own items into tiers and scores; this applies the tiers and the hysteresis, so the card does not
 * change face at every transaction.
 */

/** At most this many exceptions get a row of their own on a target card. */
export const MAX_TARGET_EVENTS = 3;

/** How much a rival must beat the featured item by: 5% of a limit, or 5 points of a ratio. */
export const FEATURE_MARGIN = 0.05;

export interface RankedTarget {
  id: string;
  /** Higher tiers win outright, whatever the score. */
  tier: number;
  /** Ranks items inside a tier, higher first. */
  score: number;
  /** How far a rival in the same tier must beat this item's score to take its place. */
  margin: number;
}

/**
 * @param previousId the item featured last time (device-local), or null
 * @returns the id to feature, or null when there are no items
 */
export function featuredTarget(
  items: readonly RankedTarget[],
  previousId: string | null,
): string | null {
  let best: RankedTarget | undefined;
  for (const item of items) {
    if (
      best === undefined ||
      item.tier > best.tier ||
      (item.tier === best.tier && item.score > best.score)
    ) {
      best = item;
    }
  }
  if (best === undefined) return null;
  const previous =
    previousId === null ? undefined : items.find((item) => item.id === previousId);
  if (previous === undefined || best.tier > previous.tier) return best.id;
  return best.score - previous.score > previous.margin ? best.id : previous.id;
}
```

Add to `packages/core/src/index.ts`, keeping the alphabetical order (after `./stats`):

```ts
export * from './targets';
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter @saldo/core test -- targets`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/core/src/targets.ts packages/core/src/targets.test.ts packages/core/src/index.ts
rtk git commit -m "feat(core): featuredTarget ranks target-card items with hysteresis"
```

---

### Task 4: Budget ranking, events, status and advice

**Files:**
- Create: `packages/core/src/budgetTargets.ts`
- Test: `packages/core/src/budgetTargets.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/budgetTargets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  type BudgetTargetInput,
  budgetAdvice,
  budgetCardStatus,
  budgetEventIds,
  rankBudget,
} from './budgetTargets';

function budget(id: string, spent: number, limit: number, pace = 0.8): BudgetTargetInput {
  const ratio = spent / limit;
  return {
    id,
    pace,
    progress: { spent, limit, ratio, overPace: ratio > pace, overLimit: ratio > 1 },
  };
}

describe('rankBudget', () => {
  it('puts a budget over its limit in the top tier, scored by the overrun in money', () => {
    expect(rankBudget(budget('spesa', 43080, 42000))).toEqual({
      id: 'spesa',
      tier: 2,
      score: 1080,
      margin: 2100,
    });
  });

  it('puts a budget over pace in the middle tier, scored by how far past the pace', () => {
    const ranked = rankBudget(budget('shopping', 8900, 10000));
    expect(ranked.tier).toBe(1);
    expect(ranked.score).toBeCloseTo(0.09, 10);
    expect(ranked.margin).toBe(0.05);
  });

  it('ranks the rest by how close they are to the pace', () => {
    const ranked = rankBudget(budget('trasporti', 11780, 25000));
    expect(ranked.tier).toBe(0);
    expect(ranked.score).toBeCloseTo(0.4712 / 0.8, 10);
  });

  it('scores the rest by ratio alone on the first day, when the pace is 0', () => {
    expect(rankBudget(budget('svago', 0, 12000, 0)).score).toBe(0);
  });
});

describe('budgetEventIds', () => {
  const items = [
    budget('spesa', 43080, 42000),
    budget('ristoranti', 20800, 20000),
    budget('casa', 70100, 70000),
    budget('auto', 30500, 30000),
    budget('bar', 12300, 12000),
    budget('trasporti', 11780, 25000),
  ];

  it('lists the budgets over their limit, largest overrun first, featured one left out', () => {
    expect(budgetEventIds(items, 'spesa')).toEqual(['ristoranti', 'auto', 'bar']);
  });

  it('keeps at most three', () => {
    expect(budgetEventIds(items, 'trasporti')).toHaveLength(3);
  });

  it('never lists a budget that is only over pace', () => {
    expect(budgetEventIds([budget('shopping', 8900, 10000)], null)).toEqual([]);
  });
});

describe('budgetCardStatus', () => {
  it('counts the budgets over their limit first', () => {
    expect(
      budgetCardStatus([budget('a', 43080, 42000), budget('b', 8900, 10000)]),
    ).toEqual({ kind: 'overLimit', count: 1 });
  });

  it('then the budgets over pace', () => {
    expect(budgetCardStatus([budget('b', 8900, 10000), budget('c', 100, 10000)])).toEqual({
      kind: 'overPace',
      count: 1,
    });
  });

  it('says within limits otherwise', () => {
    expect(budgetCardStatus([budget('c', 100, 10000)])).toEqual({ kind: 'withinLimits' });
  });
});

describe('budgetAdvice', () => {
  it('spreads what is left over the days left, today included, rounding down', () => {
    // 420,00 € limit, 368,40 € spent, pace 0.8: 51,60 € over 7 days.
    const input = budget('spesa', 36840, 42000);
    expect(budgetAdvice(input.progress, input.pace, true, 7)).toEqual({
      kind: 'perDay',
      perDay: 737,
      gap: 3240,
      overPace: true,
    });
  });

  it('reports the gap under pace as a positive amount', () => {
    const input = budget('spesa', 30120, 42000);
    expect(budgetAdvice(input.progress, input.pace, true, 7)).toMatchObject({
      gap: 3480,
      overPace: false,
    });
  });

  it('says by how much the limit is exceeded', () => {
    const input = budget('spesa', 43080, 42000);
    expect(budgetAdvice(input.progress, input.pace, true, 7)).toEqual({
      kind: 'overLimit',
      overrun: 1080,
    });
  });

  it('gives no advice per day on a closed range, only where it ended', () => {
    const input = budget('spesa', 30120, 42000, 1);
    expect(budgetAdvice(input.progress, input.pace, false, 0)).toEqual({
      kind: 'closed',
      percent: 72,
    });
  });

  it('never divides by zero days', () => {
    const input = budget('spesa', 30120, 42000, 1);
    expect(budgetAdvice(input.progress, input.pace, true, 0)).toMatchObject({ perDay: 11880 });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- budgetTargets`
Expected: FAIL — `Cannot find module './budgetTargets'`.

- [ ] **Step 3: Implement**

Create `packages/core/src/budgetTargets.ts`:

```ts
import type { BudgetProgress } from './budgets';
import { FEATURE_MARGIN, MAX_TARGET_EVENTS, type RankedTarget } from './targets';

/** A budget as the target card sees it (§5.13). */
export interface BudgetTargetInput {
  id: string;
  progress: Pick<BudgetProgress, 'spent' | 'limit' | 'ratio' | 'overPace' | 'overLimit'>;
  /** elapsed / length of the budget's own range. */
  pace: number;
}

/** Over limit (money) → over pace (points past the pace) → the rest (closest to pace first). */
export function rankBudget({ id, progress, pace }: BudgetTargetInput): RankedTarget {
  if (progress.overLimit) {
    return {
      id,
      tier: 2,
      score: progress.spent - progress.limit,
      margin: FEATURE_MARGIN * progress.limit,
    };
  }
  if (progress.overPace) {
    return { id, tier: 1, score: progress.ratio - pace, margin: FEATURE_MARGIN };
  }
  return {
    id,
    tier: 0,
    score: pace > 0 ? progress.ratio / pace : progress.ratio,
    margin: FEATURE_MARGIN,
  };
}

const overrun = (item: BudgetTargetInput): number => item.progress.spent - item.progress.limit;

/** The exceptions that get a row: over the limit, largest overrun first, at most three. */
export function budgetEventIds(
  items: readonly BudgetTargetInput[],
  featuredId: string | null,
): string[] {
  return items
    .filter((item) => item.id !== featuredId && item.progress.overLimit)
    .sort((a, b) => overrun(b) - overrun(a))
    .slice(0, MAX_TARGET_EVENTS)
    .map((item) => item.id);
}

export type BudgetCardStatus =
  | { kind: 'overLimit'; count: number }
  | { kind: 'overPace'; count: number }
  | { kind: 'withinLimits' };

/** The header's status line: over the limit beats over pace, which beats "within limits". */
export function budgetCardStatus(items: readonly BudgetTargetInput[]): BudgetCardStatus {
  const overLimit = items.filter((item) => item.progress.overLimit).length;
  if (overLimit > 0) return { kind: 'overLimit', count: overLimit };
  const overPace = items.filter((item) => item.progress.overPace).length;
  if (overPace > 0) return { kind: 'overPace', count: overPace };
  return { kind: 'withinLimits' };
}

export type BudgetAdvice =
  /** `perDay` is rounded down: it is a ceiling. `gap` is |spent − limit × pace|. */
  | { kind: 'perDay'; perDay: number; gap: number; overPace: boolean }
  | { kind: 'overLimit'; overrun: number }
  | { kind: 'closed'; percent: number };

/**
 * What the featured budget's sentence says (§5.13).
 *
 * @param open whether the range still contains today
 * @param daysToSpend days left in the range, today and the last day included
 */
export function budgetAdvice(
  progress: Pick<BudgetProgress, 'spent' | 'limit' | 'ratio'>,
  pace: number,
  open: boolean,
  daysToSpend: number,
): BudgetAdvice {
  if (progress.spent > progress.limit) {
    return { kind: 'overLimit', overrun: progress.spent - progress.limit };
  }
  if (!open) return { kind: 'closed', percent: Math.round(progress.ratio * 100) };
  const gap = Math.round(progress.spent - progress.limit * pace);
  return {
    kind: 'perDay',
    perDay: Math.floor((progress.limit - progress.spent) / Math.max(1, daysToSpend)),
    gap: Math.abs(gap),
    overPace: gap > 0,
  };
}
```

Add to `packages/core/src/index.ts` after `export * from './budgetRanges';`:

```ts
export * from './budgetTargets';
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter @saldo/core test -- budgetTargets`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/core/src/budgetTargets.ts packages/core/src/budgetTargets.test.ts packages/core/src/index.ts
rtk git commit -m "feat(core): rank, list and advise budgets for the target card"
```

---

### Task 5: `BudgetView.pace`

**Files:**
- Modify: `apps/mobile/src/features/budgets/useBudgetProgress.ts`
- Test: `apps/mobile/src/features/budgets/useBudgetProgress.test.ts`

- [ ] **Step 1: Write the failing test**

In `useBudgetProgress.test.ts`, change the test `'reports the days left and whether the range is still open'` to:

```ts
  it('reports the days left, the pace and whether the range is still open', () => {
    const result = view({}, []);
    // Cycle is 31 days and today is day 23.
    expect(result.daysLeft).toBe(8);
    expect(result.pace).toBeCloseTo(23 / 31, 10);
    expect(result.open).toBe(true);
  });
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/budgets/useBudgetProgress.test.ts`
Expected: FAIL — `expected undefined to be close to 0.7419…`.

- [ ] **Step 3: Implement**

In `useBudgetProgress.ts`, add to `BudgetView` after `daysLeft`:

```ts
  /** elapsed / length of the range: where the pace tick sits (§5.2). */
  pace: number;
```

and in `budgetViews`, replace:

```ts
    const length = cycleLength(range);
    const elapsed = elapsedDays(range, today);
    const progress = budgetProgress(
      { ...budget, amount: limitWithCarry },
      spending,
      categories,
      length === 0 ? 0 : elapsed / length,
    );
```

with:

```ts
    const length = cycleLength(range);
    const elapsed = elapsedDays(range, today);
    const pace = length === 0 ? 0 : elapsed / length;
    const progress = budgetProgress(
      { ...budget, amount: limitWithCarry },
      spending,
      categories,
      pace,
    );
```

and add `pace,` to the returned object, after `daysLeft: Math.max(0, length - elapsed),`.

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/budgets`
Expected: `useBudgetProgress.test.ts` PASS. `HomeBudgetCard.test.tsx` now fails typecheck on its `view()` helper only at `pnpm typecheck` time (jest does not type-check); it is rewritten in Task 11.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/mobile/src/features/budgets/useBudgetProgress.ts apps/mobile/src/features/budgets/useBudgetProgress.test.ts
rtk git commit -m "feat(mobile): budget views carry their pace"
```

---

### Task 6: `ProgressBar` thick variant

**Files:**
- Modify: `apps/mobile/src/components/ProgressBar.tsx`

- [ ] **Step 1: Add the prop**

In `ProgressBarProps`, after `hideable?: boolean;`:

```ts
  /** The featured item of a target card (§5.13): 8pt with a longer pace tick. */
  thick?: boolean;
```

Change the signature to:

```ts
export function ProgressBar({
  ratio,
  pace,
  overPace = false,
  hideable = true,
  thick = false,
}: ProgressBarProps) {
```

After `const theme = useTheme();` add:

```ts
  const height = thick ? theme.layout.progressHeightThick : theme.layout.progressHeight;
  const overhang = thick ? theme.layout.paceTickOverhangThick : theme.layout.paceTickOverhang;
```

Then replace every `theme.layout.progressHeight` in the JSX with `height` (three places: the track, the fill, and the tick's height sum) and every `theme.layout.paceTickOverhang` with `overhang` (two places: `top` and the tick's height sum). The tick becomes:

```tsx
        <View
          style={{
            position: 'absolute',
            left: `${Math.min(1, Math.max(0, pace)) * 100}%`,
            top: -overhang,
            width: 1,
            height: height + overhang * 2,
            backgroundColor: theme.palette.textFaint,
          }}
        />
```

- [ ] **Step 2: Check nothing else moved**

Run: `rtk proxy pnpm --filter mobile test` and `rtk proxy pnpm --filter mobile typecheck`
Expected: no new failures (the default path is unchanged). If `mobile` has no `typecheck` script, run `rtk proxy pnpm typecheck` at the root.

- [ ] **Step 3: Commit**

```bash
rtk git add apps/mobile/src/components/ProgressBar.tsx
rtk git commit -m "feat(mobile): thick progress bar for featured targets"
```

---

### Task 7: `TargetRing`

**Files:**
- Create: `apps/mobile/src/components/ringGeometry.ts`, `apps/mobile/src/components/ringGeometry.test.ts`
- Create: `apps/mobile/src/components/TargetRing.tsx`, `apps/mobile/src/components/TargetRing.test.tsx`

- [ ] **Step 1: Write the failing geometry test**

Create `apps/mobile/src/components/ringGeometry.test.ts`:

```ts
import { ringGeometry } from './ringGeometry';

describe('ringGeometry', () => {
  it('fills the share of the circle the ratio asks for', () => {
    const ring = ringGeometry(36, 0.5, null);
    expect(ring.dash).toBeCloseTo(ring.circumference / 2, 10);
  });

  it('never fills past the whole circle, nor below nothing', () => {
    expect(ringGeometry(36, 1.4, null).dash).toBeCloseTo(ringGeometry(36, 1, null).circumference, 10);
    expect(ringGeometry(36, -0.2, null).dash).toBe(0);
  });

  it('draws no tick without a pace', () => {
    expect(ringGeometry(36, 0.5, null).tick).toBeNull();
  });

  it('puts the tick at the pace, before the −90° rotation the ring applies', () => {
    const ring = ringGeometry(36, 0.5, 0);
    // Angle 0 is the positive x axis; the ring's rotation turns it to 12 o'clock.
    expect(ring.tick?.y1).toBeCloseTo(ring.centre, 10);
    expect(ring.tick?.x1).toBeLessThan(ring.tick?.x2 ?? 0);
    expect(ring.tick?.x2).toBeLessThanOrEqual(36);
  });

  it('keeps a thinner stroke and a smaller icon on the preview ring', () => {
    expect(ringGeometry(28, 0, null).stroke).toBeLessThan(ringGeometry(36, 0, null).stroke);
    expect(ringGeometry(28, 0, null).icon).toBeLessThan(ringGeometry(36, 0, null).icon);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/components/ringGeometry.test.ts`
Expected: FAIL — `Cannot find module './ringGeometry'`.

- [ ] **Step 3: Implement the geometry**

Create `apps/mobile/src/components/ringGeometry.ts`:

```ts
export interface RingGeometry {
  centre: number;
  radius: number;
  stroke: number;
  circumference: number;
  /** Length of the filled arc. */
  dash: number;
  /** Icon size in the middle. */
  icon: number;
  /** The pace tick, across the stroke; null without a pace. */
  tick: { x1: number; y1: number; x2: number; y2: number } | null;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * A target ring (§5.13) of `size` points. Angles start on the positive x axis: `TargetRing`
 * rotates the whole drawing by −90° so that 0 sits at 12 o'clock.
 */
export function ringGeometry(size: number, ratio: number, pace: number | null): RingGeometry {
  const large = size >= 36;
  const stroke = large ? 3 : 2.5;
  const centre = size / 2;
  const radius = centre - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  let tick: RingGeometry['tick'] = null;
  if (pace !== null) {
    const angle = clamp(pace) * 2 * Math.PI;
    const inner = radius - stroke;
    const outer = centre - 0.5;
    tick = {
      x1: centre + inner * Math.cos(angle),
      y1: centre + inner * Math.sin(angle),
      x2: centre + outer * Math.cos(angle),
      y2: centre + outer * Math.sin(angle),
    };
  }
  return {
    centre,
    radius,
    stroke,
    circumference,
    dash: circumference * clamp(ratio),
    icon: large ? 14 : 12,
    tick,
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/components/ringGeometry.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing component test**

Create `apps/mobile/src/components/TargetRing.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TargetRing } from './TargetRing';

describe('TargetRing', () => {
  it('stays out of the accessibility tree: the row it sits in says everything', async () => {
    await render(
      <ThemeProvider preference="dark">
        <TargetRing
          testID="ring"
          size={36}
          ratio={0.6}
          pace={0.8}
          tone="attention"
          icon="cart"
          colour="#C57B4E"
        />
      </ThemeProvider>,
    );
    const ring = screen.getByTestId('ring');
    expect(ring.props.accessibilityElementsHidden).toBe(true);
    expect(ring.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
```

- [ ] **Step 6: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/components/TargetRing.test.tsx`
Expected: FAIL — `Cannot find module './TargetRing'`.

- [ ] **Step 7: Implement the ring**

Create `apps/mobile/src/components/TargetRing.tsx`:

```tsx
import { motion } from '@saldo/ui';
import type { IconName } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Circle, G, Line, Svg } from 'react-native-svg';
import { Icon } from '../theme/Icon';
import { EASE, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { ringGeometry } from './ringGeometry';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * `attention`: over pace or over the limit (a budget), behind or expired (a goal). Colour carries
 * the meaning, never fullness: a full ring is bad on a budget and good on a goal (§5.13).
 */
export type TargetTone = 'attention' | 'plain';

export interface TargetRingProps {
  size: number;
  /** 0..1, clamped. */
  ratio: number;
  /** Where the pace tick sits, or null for none (a closed range). */
  pace: number | null;
  tone: TargetTone;
  icon: IconName;
  /** The item's colour, for the icon in the middle. */
  colour: string;
  testID?: string;
}

/**
 * Progress, pace and icon in one mark: the icon box of a row that has a target.
 *
 * Starts at its value and animates only a **change** of it, as `ProgressBar` does: Home is opened
 * tens of times a day, so a ring filling on every open would be noise, while one moving after a
 * new expense confirms what changed. `strokeDashoffset` runs on the UI thread and costs no layout.
 */
export function TargetRing({ size, ratio, pace, tone, icon, colour, testID }: TargetRingProps) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const ring = ringGeometry(size, ratio, pace);
  const target = Math.min(1, Math.max(0, ratio));
  const progress = useSharedValue(target);
  useEffect(() => {
    progress.value = reduced
      ? target
      : withTiming(target, { duration: motion.progressMs, easing: EASE });
  }, [target, reduced, progress]);
  const { circumference } = ring;
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
    // A zero-length dash still draws its round cap as a dot.
    opacity: progress.value > 0 ? 1 : 0,
  }));
  const fill = tone === 'attention' ? theme.palette.accent : theme.palette.barGrey;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <G rotation={-90} origin={`${ring.centre}, ${ring.centre}`}>
          <Circle
            cx={ring.centre}
            cy={ring.centre}
            r={ring.radius}
            stroke={theme.palette.track}
            strokeWidth={ring.stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={ring.centre}
            cy={ring.centre}
            r={ring.radius}
            stroke={fill}
            strokeWidth={ring.stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeLinecap="round"
            fill="none"
            animatedProps={arc}
          />
          {ring.tick === null ? null : (
            <Line {...ring.tick} stroke={theme.palette.textFaint} strokeWidth={1.25} />
          )}
        </G>
      </Svg>
      <Icon name={icon} size={ring.icon} color={colour} />
    </View>
  );
}
```

Then restate the motion rule in `apps/mobile/src/theme/motion.ts`. Replace:

```ts
 *  - **Only `transform` and `opacity`.** Everything else costs layout on every frame.
```

with:

```ts
 *  - **Nothing that costs layout on every frame.** `transform` and `opacity`, plus SVG props driven
 *    by `useAnimatedProps` on the UI thread (a ring's `strokeDashoffset`); never width, height,
 *    margins or padding.
```

- [ ] **Step 8: Run it and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/components/TargetRing.test.tsx src/components/ringGeometry.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
rtk git add apps/mobile/src/components/ringGeometry.ts apps/mobile/src/components/ringGeometry.test.ts apps/mobile/src/components/TargetRing.tsx apps/mobile/src/components/TargetRing.test.tsx apps/mobile/src/theme/motion.ts
rtk git commit -m "feat(mobile): TargetRing draws progress, pace and icon, animating changes only"
```

---

### Task 8: `targets` strings in every locale

**Files:**
- Modify: `packages/i18n/src/locales/it.ts`, `en.ts`, `fr.ts`, `de.ts`, `sv.ts`, `es.ts`, `pt.ts`

Each catalog gets a `targets` block right after its `home: { … },` block (before the closing `};`). `<b>…</b>` marks the part of the sentence rendered at weight 500 through `Trans` (Task 10). The parity test (`locales.test.ts`) checks the keys and the `{{variables}}` against `it.ts`.

- [ ] **Step 1: Italian (the source)**

In `packages/i18n/src/locales/it.ts`, after the `home` block:

```ts
  targets: {
    today: 'oggi',
    percent: '{{value}}%',
    ofLimit: 'di {{amount}} · {{percent}}',
    left: '{{amount}} rimasti',
    overLimitMeta: 'limite superato',
    closedMeta: 'periodo chiuso',
    overLimit_one: '{{count}} oltre il limite',
    overLimit_other: '{{count}} oltre il limite',
    overLimitBy: '{{amount}} oltre il limite',
    overPaceBy: '{{amount}} oltre il ritmo',
    inLine: 'in linea',
    perDay: 'Puoi spendere ancora <b>{{amount}} al giorno</b> fino al {{end}}.',
    stateOverPace: 'Sei {{amount}} oltre il ritmo.',
    stateUnderPace: 'Sei {{amount}} sotto il ritmo.',
    overLimitAction: 'Hai superato il limite di <b>{{amount}}</b>.',
    overLimitState: 'Ogni altra spesa in {{name}} si aggiunge, fino al {{end}}.',
    closed: 'Periodo chiuso al <b>{{percent}}</b> del limite.',
    allBudgets: 'Tutti i budget',
    createBudget: 'Crea un budget',
    itemLabel: '{{name}}, {{amount}} di {{limit}}, {{status}}',
  },
```

- [ ] **Step 2: English**

In `en.ts`, after the `home` block:

```ts
  targets: {
    today: 'today',
    percent: '{{value}}%',
    ofLimit: 'of {{amount}} · {{percent}}',
    left: '{{amount}} left',
    overLimitMeta: 'over the limit',
    closedMeta: 'period closed',
    overLimit_one: '{{count}} over the limit',
    overLimit_other: '{{count}} over the limit',
    overLimitBy: '{{amount}} over the limit',
    overPaceBy: '{{amount}} over pace',
    inLine: 'on pace',
    perDay: 'You can still spend <b>{{amount}} a day</b> until {{end}}.',
    stateOverPace: "You're {{amount}} over pace.",
    stateUnderPace: "You're {{amount}} under pace.",
    overLimitAction: "You're <b>{{amount}}</b> over the limit.",
    overLimitState: 'Anything else in {{name}} adds to it, until {{end}}.',
    closed: 'Period closed at <b>{{percent}}</b> of the limit.',
    allBudgets: 'All budgets',
    createBudget: 'Create a budget',
    itemLabel: '{{name}}, {{amount}} of {{limit}}, {{status}}',
  },
```

- [ ] **Step 3: French**

In `fr.ts`, after the `home` block:

```ts
  targets: {
    today: 'aujourd’hui',
    percent: '{{value}} %',
    ofLimit: 'sur {{amount}} · {{percent}}',
    left: 'reste {{amount}}',
    overLimitMeta: 'limite dépassée',
    closedMeta: 'période close',
    overLimit_one: '{{count}} au-dessus de la limite',
    overLimit_other: '{{count}} au-dessus de la limite',
    overLimitBy: '{{amount}} au-dessus de la limite',
    overPaceBy: '{{amount}} au-dessus du rythme',
    inLine: 'dans le rythme',
    perDay: 'Tu peux encore dépenser <b>{{amount}} par jour</b> jusqu’au {{end}}.',
    stateOverPace: 'Tu es {{amount}} au-dessus du rythme.',
    stateUnderPace: 'Tu es {{amount}} en dessous du rythme.',
    overLimitAction: 'Tu as dépassé la limite de <b>{{amount}}</b>.',
    overLimitState: 'Toute autre dépense en {{name}} s’y ajoute, jusqu’au {{end}}.',
    closed: 'Période close à <b>{{percent}}</b> de la limite.',
    allBudgets: 'Tous les budgets',
    createBudget: 'Créer un budget',
    itemLabel: '{{name}}, {{amount}} sur {{limit}}, {{status}}',
  },
```

- [ ] **Step 4: German**

In `de.ts`, after the `home` block:

```ts
  targets: {
    today: 'heute',
    percent: '{{value}} %',
    ofLimit: 'von {{amount}} · {{percent}}',
    left: 'noch {{amount}}',
    overLimitMeta: 'Limit überschritten',
    closedMeta: 'Zeitraum beendet',
    overLimit_one: '{{count}} über dem Limit',
    overLimit_other: '{{count}} über dem Limit',
    overLimitBy: '{{amount}} über dem Limit',
    overPaceBy: '{{amount}} über dem Tempo',
    inLine: 'im Tempo',
    perDay: 'Du kannst noch <b>{{amount}} pro Tag</b> ausgeben, bis {{end}}.',
    stateOverPace: 'Du liegst {{amount}} über dem Tempo.',
    stateUnderPace: 'Du liegst {{amount}} unter dem Tempo.',
    overLimitAction: 'Du hast das Limit um <b>{{amount}}</b> überschritten.',
    overLimitState: 'Jede weitere Ausgabe in {{name}} kommt dazu, bis {{end}}.',
    closed: 'Zeitraum beendet bei <b>{{percent}}</b> des Limits.',
    allBudgets: 'Alle Budgets',
    createBudget: 'Budget erstellen',
    itemLabel: '{{name}}, {{amount}} von {{limit}}, {{status}}',
  },
```

- [ ] **Step 5: Swedish**

In `sv.ts`, after the `home` block:

```ts
  targets: {
    today: 'i dag',
    percent: '{{value}} %',
    ofLimit: 'av {{amount}} · {{percent}}',
    left: '{{amount}} kvar',
    overLimitMeta: 'över gränsen',
    closedMeta: 'perioden avslutad',
    overLimit_one: '{{count}} över gränsen',
    overLimit_other: '{{count}} över gränsen',
    overLimitBy: '{{amount}} över gränsen',
    overPaceBy: '{{amount}} över takten',
    inLine: 'i takt',
    perDay: 'Du kan fortfarande spendera <b>{{amount}} om dagen</b> till och med {{end}}.',
    stateOverPace: 'Du ligger {{amount}} över takten.',
    stateUnderPace: 'Du ligger {{amount}} under takten.',
    overLimitAction: 'Du har gått över gränsen med <b>{{amount}}</b>.',
    overLimitState: 'Allt annat i {{name}} läggs till, till och med {{end}}.',
    closed: 'Perioden avslutades på <b>{{percent}}</b> av gränsen.',
    allBudgets: 'Alla budgetar',
    createBudget: 'Skapa en budget',
    itemLabel: '{{name}}, {{amount}} av {{limit}}, {{status}}',
  },
```

- [ ] **Step 6: Spanish**

In `es.ts`, after the `home` block:

```ts
  targets: {
    today: 'hoy',
    percent: '{{value}} %',
    ofLimit: 'de {{amount}} · {{percent}}',
    left: 'quedan {{amount}}',
    overLimitMeta: 'límite superado',
    closedMeta: 'periodo cerrado',
    overLimit_one: '{{count}} por encima del límite',
    overLimit_other: '{{count}} por encima del límite',
    overLimitBy: '{{amount}} por encima del límite',
    overPaceBy: '{{amount}} por encima del ritmo',
    inLine: 'al ritmo',
    perDay: 'Aún puedes gastar <b>{{amount}} al día</b> hasta el {{end}}.',
    stateOverPace: 'Vas {{amount}} por encima del ritmo.',
    stateUnderPace: 'Vas {{amount}} por debajo del ritmo.',
    overLimitAction: 'Has superado el límite en <b>{{amount}}</b>.',
    overLimitState: 'Cualquier otro gasto en {{name}} se suma, hasta el {{end}}.',
    closed: 'Periodo cerrado al <b>{{percent}}</b> del límite.',
    allBudgets: 'Todos los presupuestos',
    createBudget: 'Crear un presupuesto',
    itemLabel: '{{name}}, {{amount}} de {{limit}}, {{status}}',
  },
```

- [ ] **Step 7: Portuguese (European, "tu")**

In `pt.ts`, after the `home` block:

```ts
  targets: {
    today: 'hoje',
    percent: '{{value}}%',
    ofLimit: 'de {{amount}} · {{percent}}',
    left: 'restam {{amount}}',
    overLimitMeta: 'limite ultrapassado',
    closedMeta: 'período encerrado',
    overLimit_one: '{{count}} acima do limite',
    overLimit_other: '{{count}} acima do limite',
    overLimitBy: '{{amount}} acima do limite',
    overPaceBy: '{{amount}} acima do ritmo',
    inLine: 'no ritmo',
    perDay: 'Ainda podes gastar <b>{{amount}} por dia</b> até {{end}}.',
    stateOverPace: 'Estás {{amount}} acima do ritmo.',
    stateUnderPace: 'Estás {{amount}} abaixo do ritmo.',
    overLimitAction: 'Ultrapassaste o limite em <b>{{amount}}</b>.',
    overLimitState: 'Qualquer outra despesa em {{name}} soma-se, até {{end}}.',
    closed: 'Período encerrado a <b>{{percent}}</b> do limite.',
    allBudgets: 'Todos os orçamentos',
    createBudget: 'Criar um orçamento',
    itemLabel: '{{name}}, {{amount}} de {{limit}}, {{status}}',
  },
```

- [ ] **Step 8: Run the parity test**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS (same keys and variables in all seven catalogs).

- [ ] **Step 9: Commit**

```bash
rtk git add packages/i18n/src/locales
rtk git commit -m "feat(i18n): target card strings"
```

---

### Task 9: Budgets screen — open a budget from a link, real pace tick

**Files:**
- Modify: `apps/mobile/app/budgets.tsx`

The Home card's featured budget and event rows open the budget detail sheet (§5.13 "Taps"). The sheet lives on the budgets screen, so Home pushes `/budgets?open={id}`.

- [ ] **Step 1: Seed the open sheet from the route**

Change the import `import { useRouter } from 'expo-router';` to:

```ts
import { useLocalSearchParams, useRouter } from 'expo-router';
```

and replace:

```ts
  const [openId, setOpenId] = useState<string | null>(null);
```

with:

```ts
  // Home's target card opens a budget here (§5.13): the detail sheet belongs to this screen.
  const { open } = useLocalSearchParams<{ open?: string }>();
  const [openId, setOpenId] = useState<string | null>(open ?? null);
```

- [ ] **Step 2: Draw the pace tick at the pace**

Replace:

```tsx
                    pace={view.open ? view.spent / Math.max(1, view.limitWithCarry) : undefined}
```

with:

```tsx
                    pace={view.open ? view.pace : undefined}
```

- [ ] **Step 3: Typecheck**

Run: `rtk proxy pnpm typecheck`
Expected: only the `HomeBudgetCard.test.tsx` error about `pace` missing in its `view()` helper (fixed in Task 11). Nothing in `budgets.tsx`.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/mobile/app/budgets.tsx
rtk git commit -m "fix(mobile): budget list draws the pace tick at the pace, opens a budget from a link"
```

---

### Task 10: `FeaturedTarget` and `SeeAllRow`

**Files:**
- Create: `apps/mobile/src/features/targets/endLabels.ts`, `apps/mobile/src/features/targets/endLabels.test.ts`
- Create: `apps/mobile/src/features/targets/FeaturedTarget.tsx`
- Create: `apps/mobile/src/features/targets/SeeAllRow.tsx`

Both components are exercised through `HomeBudgetCard.test.tsx` (Task 11); the one piece of logic they own, which labels show under the bar, is tested here.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/targets/endLabels.test.ts`:

```ts
import { endLabels } from './endLabels';

describe('endLabels', () => {
  it('shows the start, today and the end mid-range', () => {
    expect(endLabels(0.5)).toEqual({ start: true, today: true, end: true });
  });

  it('drops the end once «oggi» is close to it', () => {
    expect(endLabels(0.8)).toEqual({ start: true, today: true, end: false });
  });

  it('drops the start while «oggi» is close to it', () => {
    expect(endLabels(0.1)).toEqual({ start: false, today: true, end: true });
  });

  it('shows both ends and no «oggi» without a pace', () => {
    expect(endLabels(null)).toEqual({ start: true, today: false, end: true });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/targets`
Expected: FAIL — `Cannot find module './endLabels'`.

- [ ] **Step 3: Implement `endLabels`**

Create `apps/mobile/src/features/targets/endLabels.ts`:

```ts
export interface EndLabels {
  start: boolean;
  today: boolean;
  end: boolean;
}

/**
 * Which labels sit under a featured bar (§5.13): the range's start and end, and «oggi» at the
 * tick. An end label steps aside when «oggi» would collide with it; without a pace (a closed
 * range, a reached goal) there is no «oggi» at all.
 */
export function endLabels(pace: number | null): EndLabels {
  if (pace === null) return { start: true, today: false, end: true };
  return { start: pace > 0.18, today: true, end: pace < 0.78 };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/targets`
Expected: PASS, 4 tests.

- [ ] **Step 5: Create `FeaturedTarget`**

Create `apps/mobile/src/features/targets/FeaturedTarget.tsx`:

```tsx
import type { CurrencyCode } from '@saldo/core';
import type { AppLocale } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../../components/AmountText';
import { IconBox } from '../../components/ListRow';
import { ProgressBar } from '../../components/ProgressBar';
import type { TargetTone } from '../../components/TargetRing';
import { Text } from '../../theme/Text';
import { endLabels } from './endLabels';

/** Wide enough for «oggi» in every locale, centred on the tick. */
const TODAY_WIDTH = 64;

export interface FeaturedTargetProps {
  icon: IconName;
  colour: string;
  name: string;
  /** Short, beside the name: "52 € rimasti", "limite superato". */
  meta: string;
  /** What fills the bar: spent for a budget, saved for a goal. */
  amount: number;
  currency: CurrencyCode;
  locale: AppLocale;
  /** "di 420,00 € · 88%". */
  of: string;
  ratio: number;
  /** Where the tick and «oggi» sit; null for none. */
  pace: number | null;
  tone: TargetTone;
  /** Labels of the range's two ends. */
  start: string;
  end: string;
  /** Action, then state — the caller composes it. */
  sentence: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
}

/**
 * The one item a target card lifts into view (§5.13): the figure that fills the bar, the bar with
 * its pace, and a sentence that says what to do. Amounts stay visible in hidden mode, like the
 * Home budget card always has.
 */
export function FeaturedTarget(props: FeaturedTargetProps) {
  const { t } = useTranslation();
  const labels = endLabels(props.pace);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingTop: 14, paddingBottom: 16 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBox name={props.icon} colour={props.colour} />
        <Text style={{ flex: 1 }} numberOfLines={1}>
          {props.name}
        </Text>
        <Text size="footnote" color="textMuted" numberOfLines={1}>
          {props.meta}
        </Text>
      </View>
      <AmountText
        plain
        minor={props.amount}
        currency={props.currency}
        locale={props.locale}
        size="amountLg"
        weight="semibold"
        tracking="tighter"
        style={{ marginTop: 14 }}
      />
      <Text size="footnote" color="textMuted">
        {props.of}
      </Text>
      <View style={{ marginTop: 16 }}>
        <ProgressBar
          thick
          hideable={false}
          ratio={props.ratio}
          pace={props.pace ?? undefined}
          overPace={props.tone === 'attention'}
        />
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height: 16, marginTop: 6 }}
      >
        {labels.start ? (
          <Text size="caption" color="textFaint" style={{ position: 'absolute', left: 0 }}>
            {props.start}
          </Text>
        ) : null}
        {labels.today && props.pace !== null ? (
          <Text
            size="caption"
            color="textMuted"
            style={{
              position: 'absolute',
              left: `${props.pace * 100}%`,
              width: TODAY_WIDTH,
              marginLeft: -TODAY_WIDTH / 2,
              textAlign: 'center',
            }}
          >
            {t('targets.today')}
          </Text>
        ) : null}
        {labels.end ? (
          <Text size="caption" color="textFaint" style={{ position: 'absolute', right: 0 }}>
            {props.end}
          </Text>
        ) : null}
      </View>
      <Text style={{ marginTop: 12, lineHeight: 21 }}>{props.sentence}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 6: Create `SeeAllRow`**

Create `apps/mobile/src/features/targets/SeeAllRow.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { TargetRing, type TargetRingProps } from '../../components/TargetRing';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export type PreviewRing = Omit<TargetRingProps, 'size' | 'testID'> & { id: string };

export interface SeeAllRowProps {
  label: string;
  /** Total number of items, featured and events included; omitted on an empty card. */
  count?: number;
  /** Everything the card does not show, as small rings in sort order. */
  rings?: readonly PreviewRing[];
  onPress: () => void;
}

/**
 * A target card's only action (§5.13): the rest of the items as a strip of rings, then
 * "Tutti i budget · 5". A full row with a chevron, not a line of text at the bottom of the card —
 * the thing `CardHeader` was written to get rid of.
 */
export function SeeAllRow({ label, count, rings = [], onPress }: SeeAllRowProps) {
  const theme = useTheme();
  const text = count === undefined ? label : `${label} · ${count}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minHeight: theme.layout.minHitTarget,
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: theme.palette.border,
      })}
    >
      {rings.length === 0 ? (
        <Text style={{ flex: 1 }}>{text}</Text>
      ) : (
        <>
          <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {rings.map(({ id, ...ring }) => (
              <TargetRing key={id} size={theme.layout.targetRingSmall} {...ring} />
            ))}
          </View>
          <Text size="footnote" color="textMuted">
            {text}
          </Text>
        </>
      )}
      <Icon name="chevR" size={14} color={theme.palette.textFaint} />
    </Pressable>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `rtk proxy pnpm typecheck`
Expected: no errors in the new files (the `HomeBudgetCard.test.tsx` one remains until Task 11). If `theme.layout` does not expose the new tokens, check that the theme spreads `layout` from `@saldo/ui` (`src/theme/ThemeProvider.tsx`) — it does for `progressHeight`, so the new keys come with it.

- [ ] **Step 8: Commit**

```bash
rtk git add apps/mobile/src/features/targets
rtk git commit -m "feat(mobile): FeaturedTarget and SeeAllRow for target cards"
```

---

### Task 11: `HomeBudgetCard` on the target card

**Files:**
- Rewrite: `apps/mobile/src/features/budgets/HomeBudgetCard.tsx`
- Rewrite: `apps/mobile/src/features/budgets/HomeBudgetCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the whole of `HomeBudgetCard.test.tsx` with:

```tsx
import type { Budget } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { FEATURED_BUDGET_KEY, HomeBudgetCard } from './HomeBudgetCard';
import type { BudgetView } from './useBudgetProgress';

const mockPush = jest.fn();
const mockKv = new Map<string, string>();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR' }),
  useCategories: () => [{ id: 'cat-groceries', name: 'Spesa', colorIndex: 2 }],
}));

jest.mock('../../db/DatabaseProvider', () => ({
  useDatabase: () => ({
    kv: {
      get: (key: string) => mockKv.get(key) ?? null,
      set: (key: string, value: string) => {
        mockKv.set(key, value);
      },
    },
  }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockPush.mockClear();
  mockKv.clear();
});

function budget(id: string, name: string): Budget {
  return {
    id,
    name,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '1',
    deletedAt: null,
    categoryIds: ['cat-groceries'],
    amount: 40_000,
    period: 'period',
    alertThreshold: null,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
  };
}

/** A budget in the cycle 27 Mar – 26 Apr, today 18 Apr: pace 0.5 for round numbers. */
function view(id: string, name: string, spent: number, limit = 40_000, pace = 0.5): BudgetView {
  const ratio = spent / limit;
  return {
    budget: budget(id, name),
    spent,
    limit,
    ratio,
    overPace: ratio > pace,
    overLimit: ratio > 1,
    alertReached: false,
    range: { start: '2026-03-27', end: '2026-04-26' },
    daysLeft: 7,
    pace,
    open: true,
    limitWithCarry: limit,
  };
}

function card(views: readonly BudgetView[]) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <HomeBudgetCard views={views} />
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('HomeBudgetCard', () => {
  it('features the budget furthest over its limit and gives the other one a row', async () => {
    await render(
      card([
        view('b1', 'Spesa', 43_080, 42_000),
        view('b2', 'Ristoranti', 20_800, 20_000),
        view('b3', 'Trasporti', 11_780, 25_000),
      ]),
    );
    expect(screen.getByText('2 over the limit')).toBeTruthy();
    expect(
      screen.getByLabelText('Spesa, €430.80 of €420.00, €10.80 over the limit'),
    ).toBeTruthy();
    expect(screen.getByText('Ristoranti')).toBeTruthy();
    expect(screen.getByText('€8.00 over the limit')).toBeTruthy();
    // Neither featured nor an exception: only a ring in the «All budgets» row.
    expect(screen.queryByText('Trasporti')).toBeNull();
  });

  it('features the budget furthest past its pace and says how much is left per day', async () => {
    await render(card([view('b1', 'Spesa', 30_000), view('b2', 'Svago', 4_000)]));
    expect(screen.getByText('1 over pace')).toBeTruthy();
    // 100,00 € left over 8 days (today included); 300,00 € spent against 200,00 € of pace.
    expect(
      screen.getByText("You can still spend €12.50 a day until Apr 26. You're €100.00 over pace."),
    ).toBeTruthy();
    expect(screen.queryByText('Svago')).toBeNull();
  });

  it('opens the list from the «All budgets» row, which counts every budget', async () => {
    await render(
      card([view('b1', 'Spesa', 30_000), view('b2', 'Svago', 4_000), view('b3', 'Bar', 1_000)]),
    );
    await userEvent.press(screen.getByLabelText('All budgets, 3'));
    expect(mockPush).toHaveBeenCalledWith('/budgets');
  });

  it('opens the featured budget on the budgets screen', async () => {
    await render(card([view('b1', 'Spesa', 30_000)]));
    await userEvent.press(screen.getByLabelText(/^Spesa, /));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budgets', params: { open: 'b1' } });
  });

  it('keeps the budget it featured last while a rival is only slightly further along', async () => {
    mockKv.set(FEATURED_BUDGET_KEY, 'b2');
    // Both over pace: 0.62 − 0.5 against 0.60 − 0.5, two points apart, under the five-point margin.
    await render(card([view('b1', 'Spesa', 24_800), view('b2', 'Bollette', 24_000)]));
    expect(screen.getByLabelText(/^Bollette, /)).toBeTruthy();
  });

  it('remembers the budget it features', async () => {
    await render(card([view('b1', 'Spesa', 30_000), view('b2', 'Svago', 4_000)]));
    expect(mockKv.get(FEATURED_BUDGET_KEY)).toBe('b1');
  });

  /**
   * The card used to render nothing without budgets, which left the Budgets screen — and with it
   * the new-budget wizard — unreachable on a fresh install.
   */
  it('says there is no budget yet and still leads to the budgets screen', async () => {
    await render(card([]));
    expect(screen.getByText('No budgets')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Create a budget'));
    expect(mockPush).toHaveBeenCalledWith('/budgets');
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/budgets/HomeBudgetCard.test.tsx`
Expected: FAIL — `FEATURED_BUDGET_KEY` is not exported, and the old card renders "top 3" rows.

- [ ] **Step 3: Rewrite the card**

Replace the whole of `HomeBudgetCard.tsx` with:

```tsx
import {
  budgetAdvice,
  type BudgetTargetInput,
  budgetCardStatus,
  budgetEventIds,
  featuredTarget,
  rankBudget,
} from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { CardHeader } from '../../components/CardHeader';
import { ListRow } from '../../components/ListRow';
import { TargetRing, type TargetTone } from '../../components/TargetRing';
import { useDatabase } from '../../db/DatabaseProvider';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { FeaturedTarget } from '../targets/FeaturedTarget';
import { SeeAllRow } from '../targets/SeeAllRow';
import type { BudgetView } from './useBudgetProgress';

/** Device-local (never synced): the budget featured last, for the hysteresis of §5.13. */
export const FEATURED_BUDGET_KEY = 'home.featuredBudget';

const BOLD = { b: <Text weight="medium" /> };

/**
 * §5.13, D25: one budget featured with what to do about it, the budgets over their limit as rows,
 * everything else as rings behind «Tutti i budget». Follows the period selected on Home.
 */
export function HomeBudgetCard({ views }: { views: readonly BudgetView[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const { kv } = useDatabase();
  const currency = settings?.currency ?? 'EUR';

  const inputs = useMemo<BudgetTargetInput[]>(
    () => views.map((view) => ({ id: view.budget.id, progress: view, pace: view.pace })),
    [views],
  );
  const [previous, setPrevious] = useState(() => kv.get(FEATURED_BUDGET_KEY));
  const featuredId = useMemo(
    () => featuredTarget(inputs.map(rankBudget), previous),
    [inputs, previous],
  );
  useEffect(() => {
    if (featuredId === null || featuredId === previous) return;
    kv.set(FEATURED_BUDGET_KEY, featuredId);
    setPrevious(featuredId);
  }, [featuredId, previous, kv]);

  const allBudgets = () => router.push('/budgets');

  // Without budgets the card stays: it is the way into /budgets and the wizard behind it (§5.8).
  if (views.length === 0) {
    return (
      <Card>
        <CardHeader title={t('home.budget')} status={t('budgets.empty')} />
        <SeeAllRow label={t('targets.createBudget')} onPress={allBudgets} />
      </Card>
    );
  }

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const colourOf = (view: BudgetView) =>
    theme.categoryColor(
      categories.find((category) => category.id === view.budget.categoryIds[0])?.colorIndex ?? 9,
    );
  const toneOf = (view: BudgetView): TargetTone =>
    view.overPace || view.overLimit ? 'attention' : 'plain';
  const paceOf = (view: BudgetView) => (view.open ? view.pace : null);
  const statusOf = (view: BudgetView) => {
    if (view.overLimit) return t('targets.overLimitBy', { amount: money(view.spent - view.limit) });
    if (view.overPace) {
      return t('targets.overPaceBy', {
        amount: money(Math.round(view.spent - view.limit * view.pace)),
      });
    }
    return t('targets.inLine');
  };
  const percentOf = (view: BudgetView) =>
    t('targets.percent', { value: Math.round(view.ratio * 100) });
  const openBudget = (id: string) => router.push({ pathname: '/budgets', params: { open: id } });

  const status = budgetCardStatus(inputs);
  const statusText =
    status.kind === 'overLimit'
      ? t('targets.overLimit', { count: status.count })
      : status.kind === 'overPace'
        ? t('budgets.overPace', { count: status.count })
        : t('budgets.withinLimits');

  const featured = views.find((view) => view.budget.id === featuredId);
  const eventIds = budgetEventIds(inputs, featuredId);
  const events = eventIds.flatMap((id) => views.filter((view) => view.budget.id === id));
  const rest = views.filter(
    (view) => view.budget.id !== featuredId && !eventIds.includes(view.budget.id),
  );

  return (
    <Card>
      <CardHeader
        title={t('home.budget')}
        status={statusText}
        statusTone={status.kind === 'withinLimits' ? 'muted' : 'accent'}
      />

      {featured === undefined ? null : (
        <FeaturedTarget
          icon={featured.budget.icon as IconName}
          colour={colourOf(featured)}
          name={featured.budget.name}
          meta={
            featured.overLimit
              ? t('targets.overLimitMeta')
              : featured.open
                ? t('targets.left', { amount: money(featured.limit - featured.spent) })
                : t('targets.closedMeta')
          }
          amount={featured.spent}
          currency={currency}
          locale={locale}
          of={t('targets.ofLimit', { amount: money(featured.limit), percent: percentOf(featured) })}
          ratio={featured.ratio}
          pace={paceOf(featured)}
          tone={toneOf(featured)}
          start={formatDayMonth(featured.range.start, locale)}
          end={formatDayMonth(featured.range.end, locale)}
          sentence={<BudgetSentence view={featured} money={money} />}
          accessibilityLabel={t('targets.itemLabel', {
            name: featured.budget.name,
            amount: money(featured.spent),
            limit: money(featured.limit),
            status: statusOf(featured),
          })}
          onPress={() => openBudget(featured.budget.id)}
        />
      )}

      {events.length === 0 ? null : (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.palette.border, paddingTop: 4 }}>
          {events.map((view) => (
            <ListRow
              key={view.budget.id}
              title={view.budget.name}
              subtitle={t('targets.overLimitMeta')}
              leading={
                <TargetRing
                  size={theme.layout.targetRing}
                  ratio={view.ratio}
                  pace={paceOf(view)}
                  tone={toneOf(view)}
                  icon={view.budget.icon as IconName}
                  colour={colourOf(view)}
                />
              }
              trailing={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text tabular>{percentOf(view)}</Text>
                  <Text size="footnote" color="accent" tabular>
                    {statusOf(view)}
                  </Text>
                </View>
              }
              onPress={() => openBudget(view.budget.id)}
            />
          ))}
        </View>
      )}

      <SeeAllRow
        label={t('targets.allBudgets')}
        count={views.length}
        rings={rest.map((view) => ({
          id: view.budget.id,
          ratio: view.ratio,
          pace: paceOf(view),
          tone: toneOf(view),
          icon: view.budget.icon as IconName,
          colour: colourOf(view),
        }))}
        onPress={allBudgets}
      />
    </Card>
  );
}

/** Action (with its amount in bold), then state, muted (§5.13). */
function BudgetSentence({
  view,
  money,
}: {
  view: BudgetView;
  money: (minor: number) => string;
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const end = formatDayMonth(view.range.end, locale);
  // `daysLeft` excludes today; the advice spends today too.
  const advice = budgetAdvice(view, view.pace, view.open, view.daysLeft + 1);

  if (advice.kind === 'perDay') {
    return (
      <>
        <Trans
          t={t}
          i18nKey="targets.perDay"
          values={{ amount: money(advice.perDay), end }}
          components={BOLD}
        />{' '}
        <Text color="textMuted">
          {t(advice.overPace ? 'targets.stateOverPace' : 'targets.stateUnderPace', {
            amount: money(advice.gap),
          })}
        </Text>
      </>
    );
  }
  if (advice.kind === 'overLimit') {
    return (
      <>
        <Trans
          t={t}
          i18nKey="targets.overLimitAction"
          values={{ amount: money(advice.overrun) }}
          components={BOLD}
        />
        {view.open ? (
          <>
            {' '}
            <Text color="textMuted">
              {t('targets.overLimitState', { name: view.budget.name, end })}
            </Text>
          </>
        ) : null}
      </>
    );
  }
  return (
    <Trans
      t={t}
      i18nKey="targets.closed"
      values={{ percent: t('targets.percent', { value: advice.percent }) }}
      components={BOLD}
    />
  );
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/budgets`
Expected: PASS, including the 7 `HomeBudgetCard` tests.

If the sentence test fails on whitespace, print what rendered with `screen.debug()` and compare: the only join between action and state is the `{' '}`; `formatMoney` in `en` gives `€12.50`, `formatDayMonth('2026-04-26', 'en')` gives `Apr 26`. Fix the component, not the expectation, unless the difference is in `@saldo/i18n`'s documented output.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/mobile/src/features/budgets/HomeBudgetCard.tsx apps/mobile/src/features/budgets/HomeBudgetCard.test.tsx
rtk git commit -m "feat(mobile): Home budget card becomes a target card"
```

---

### Task 12: Verify the whole repository

- [ ] **Step 1: Lint**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.` (AGENTS.md: the exit code alone is not a pass). Fix formatting with `pnpm biome check --write <file>` if Biome reports only formatting.

- [ ] **Step 2: Typecheck**

Run: `rtk proxy pnpm typecheck`
Expected: every package and app passes.

- [ ] **Step 3: Tests**

Run: `rtk proxy pnpm test`
Expected: every package and app passes; read the summary lines, not the exit code.

- [ ] **Step 4: On the simulator**

Start the app (`pnpm --filter mobile start`, then `i`) with the demo data (`DevTools` on Home seeds it) and check, in dark and light:

1. Home → Budget card: one budget featured with the 8pt bar, `oggi` under the tick, and the sentence with its amount in bold.
2. A budget over its limit (add an expense larger than what is left): it takes the featured slot at once, the header reads «1 oltre il limite», the sentence reads «Hai superato il limite di …».
3. A second budget over its limit appears as a row with a 36pt ring; the others are 28pt rings in «Tutti i budget · N», which opens the list.
4. Tapping the featured budget or a row opens the budget list with that budget's detail sheet up.
5. The budget list's pace tick now sits at the day of the period, not at the end of each fill.
5b. Add an expense to a budget shown as a ring, go back to Home: the ring moves to its new value in ~300ms; reopening Home does not replay it; with Reduce Motion on it jumps.
6. Hidden mode (eye in the header): the Budget card does not change.
7. VoiceOver: the featured block reads «{name}, {speso} di {limite}, {stato}»; the rings are not announced.

- [ ] **Step 5: Tick the roadmap**

In `ROADMAP.md`, under «Goals: saving towards a target», change `- [ ] Plan A: the target card, …` to `- [x] Plan A: …` and commit:

```bash
rtk git add ROADMAP.md
rtk git commit -m "docs(roadmap): plan A of goals is done"
```

- [ ] **Step 6: Code review**

Use the **requesting-code-review** skill on the branch before merging to `main`.
