# Mascot states (Rocky, variant A+B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rocky, the raccoon of the app icon, appears in exactly three places: peeking over the «nothing yet» ghost
stack, peeking over a reached goal's card, and whole in the close sheet of a reached goal (spec D26, §13 *Mascot*,
§6.35, §6.36, §6.38).

**Architecture:** Two static PNGs (`idle`, `success`) in `apps/mobile/assets/mascot/`. One file of components,
`src/components/Mascot.tsx`: `MascotPeek` (a clipped window Rocky rises in, behind whatever is painted after it) and
`MascotCelebrate` (whole, arriving with an overshoot). Sizes, timings and the curve live in a new `mascot` token in
`@saldo/ui`. `EmptyState` puts a `MascotPeek` behind its `GhostStack`; a new `GoalCard` puts one behind a reached goal's
card; `GoalCloseSheet` takes a `reached` flag.

**Tech Stack:** React Native `Image`, Reanimated 4 (`withTiming`, `withDelay`, `useAnimatedStyle`), jest-expo +
React Native Testing Library, Vitest for `@saldo/ui`.

**Design reference:** `docs/superpowers/mockups/2026-09-24-mascot-variants.html`, tab «A+B · Scelta». Variants A–D
there are the alternatives that were rejected; D26 says why.

**Decisions taken while planning (spec silent):**
- **No Lottie.** A rise from behind an edge is one `translateY`; `lottie-react-native` would be a native dependency for
  one sheet. If the static `success` in the close sheet looks poor on device, that is a follow-up, not this plan.
- **Transactions' «nothing yet» gets Rocky too.** Its copy is shared between a new install and an empty period
  (`transactions.emptyBody`), so it shows on the first days of a period until something is recorded. Still rare
  enough; one rule for every `kind: 'yet'` beats a per-screen exception.
- **Rocky rises on every visit** to the goals list or a goal's detail while the goal is reached (the component mounts
  with the screen). He does not rise again while the screen stays open, because the component stays mounted.
- **Home's target card has no Rocky** (§13): Home is seen many times a day.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/mobile/assets/mascot/idle.png` | Create: Rocky standing with his coin, 384 px, transparent. Copy of the kit's `illustrations/states/idle.png`. |
| `apps/mobile/assets/mascot/success.png` | Create: Rocky celebrating, 480 px, transparent. Copy of the kit's `illustrations/states/success.png`. |
| `packages/ui/src/tokens.ts` | Modify: add the `mascot` token. |
| `packages/ui/src/tokens.test.ts` | Modify: the invariants of `mascot`. |
| `apps/mobile/src/components/Mascot.tsx` | Create: `MascotPeek`, `MascotCelebrate`. |
| `apps/mobile/src/components/Mascot.test.tsx` | Create: both are hidden from screen readers and render with and without Reduce Motion. |
| `apps/mobile/src/components/EmptyState.tsx` | Modify: `kind: 'yet'` draws `MascotPeek` behind `GhostStack`. |
| `apps/mobile/src/components/EmptyState.test.tsx` | Modify: Rocky only in «nothing yet». |
| `apps/mobile/src/features/goals/GoalCard.tsx` | Create: a goal's `Card`, with Rocky peeking over it when reached. |
| `apps/mobile/src/features/goals/GoalCard.test.tsx` | Create: Rocky only when reached. |
| `apps/mobile/app/goals.tsx` | Modify: open goals use `GoalCard`. |
| `apps/mobile/app/goal/[id].tsx` | Modify: the featured card uses `GoalCard`; the close sheet gets `reached`. |
| `apps/mobile/src/features/goals/GoalCloseSheet.tsx` | Modify: `reached` prop draws `MascotCelebrate`. |
| `apps/mobile/src/features/goals/GoalCloseSheet.test.tsx` | Create: Rocky only for a reached goal. |

---

## Task 1: The two PNGs

The mascot kit lives in the mascots repository (`github.com/saliougaye/mascots`, branch `mascot/saldo`; locally
`~/sandbox/my-brand-icons-gen`). The files are copies, as `apps/mobile/app.config.ts` already says of the icons.
Sizes: the largest peek is 104 pt and the celebration 136 pt, so @3x needs 312 px and 408 px.

**Files:**
- Create: `apps/mobile/assets/mascot/idle.png`, `apps/mobile/assets/mascot/success.png`

- [x] **Step 1: Copy and resize**

```bash
KIT=~/sandbox/my-brand-icons-gen/out/saldo/illustrations/states
mkdir -p apps/mobile/assets/mascot
sips -Z 384 "$KIT/idle.png" --out apps/mobile/assets/mascot/idle.png
sips -Z 480 "$KIT/success.png" --out apps/mobile/assets/mascot/success.png
```

- [x] **Step 2: Check them**

Run: `file apps/mobile/assets/mascot/*.png`
Expected: `idle.png: PNG image data, 384 x 384, 8-bit/color RGBA` and `success.png: PNG image data, 480 x 480, 8-bit/color RGBA`.
RGBA matters: an opaque PNG would paint a square over the ghost stack.

- [x] **Step 3: Commit**

```bash
rtk git add apps/mobile/assets/mascot
rtk git commit -m "chore(mobile): Rocky's idle and success poses, copied from the mascot kit"
```

---

## Task 2: The `mascot` token

**Files:**
- Modify: `packages/ui/src/tokens.ts` (after `emptyState`, before `gestures`)
- Test: `packages/ui/src/tokens.test.ts`

- [x] **Step 1: Write the failing test**

Add `mascot` to the import list at the top of `packages/ui/src/tokens.test.ts` (alphabetical, after `layout`):

```ts
import {
  categoryColorNames,
  categoryColors,
  emptyState,
  layout,
  mascot,
  motion,
  palettes,
  trackingPx,
  withAlpha,
} from './tokens';
```

Append after the `describe('emptyState', …)` block:

```ts
describe('mascot', () => {
  it('shows only part of Rocky when he peeks', () => {
    expect(mascot.emptyWindow).toBeLessThan(mascot.emptySize);
    expect(mascot.cardWindow).toBeLessThan(mascot.cardSize);
  });

  it('starts below the edge, but never so far that he rises from nothing', () => {
    expect(mascot.peekFromRatio).toBeGreaterThan(0);
    expect(mascot.peekFromRatio).toBeLessThan(1);
  });

  it('lands after the ghost stack, so he is the last thing to settle', () => {
    const stackLands = emptyState.enterMs + 2 * emptyState.staggerMs;
    expect(mascot.emptyDelayMs + mascot.peekMs).toBeGreaterThan(stackLands);
  });

  it('celebrates from a visible scale, never from zero', () => {
    expect(mascot.celebrateFromScale).toBeGreaterThanOrEqual(0.9);
    expect(mascot.celebrateFromScale).toBeLessThan(1);
  });

  it('overshoots: the one curve in the app that goes past its target', () => {
    const [, y1] = mascot.overshootEasing;
    expect(y1).toBeGreaterThan(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: FAIL — `mascot` is not exported (`Cannot read properties of undefined (reading 'emptyWindow')`), or a
TypeScript import error.

- [x] **Step 3: Add the token**

In `packages/ui/src/tokens.ts`, right after the closing `} as const;` of `emptyState`:

```ts
/**
 * Rocky (§13 *Mascot*, D26). Sizes in pt. He peeks from a window clipped at an edge: `…Window` is how much of him
 * shows above it, and he rises `peekFromRatio` of his height to get there.
 */
export const mascot = {
  /** Over the back of the ghost stack. */
  emptySize: 104,
  emptyWindow: 60,
  /** How far the window runs under the back ghost: that ghost is translucent, so keep it small. */
  emptyOverlap: 6,
  /** Starts while the back ghosts settle, lands after the whole stack (`enterMs` + two staggers). */
  emptyDelayMs: 240,
  /** Over a reached goal's card, near its trailing corner. */
  cardSize: 76,
  cardWindow: 44,
  cardInset: 18,
  peekFromRatio: 0.62,
  peekMs: 520,
  /** Whole, in the close sheet of a reached goal. */
  celebrateSize: 136,
  celebrateMs: 560,
  celebrateFromScale: 0.9,
  celebrateFromY: 14,
  /** The app's only overshoot, kept for the one moment worth celebrating. */
  overshootEasing: [0.34, 1.36, 0.64, 1] as const,
} as const;
```

`packages/ui/src/index.ts` already re-exports everything from `./tokens`; nothing to add there.

- [x] **Step 4: Run test to verify it passes**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: PASS, including the five new `mascot` tests.

- [x] **Step 5: Commit**

```bash
rtk git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
rtk git commit -m "feat(ui): mascot token for Rocky's peek and celebration"
```

---

## Task 3: `MascotPeek` and `MascotCelebrate`

**Files:**
- Create: `apps/mobile/src/components/Mascot.tsx`
- Test: `apps/mobile/src/components/Mascot.test.tsx`

Why a window: React Native paints later siblings on top, so a `MascotPeek` placed **before** the thing he peeks over is
covered by it. The window (`overflow: 'hidden'`) cuts him at the edge, which matters where the thing in front is
translucent (the ghost stack).

- [x] **Step 1: Write the failing test**

Create `apps/mobile/src/components/Mascot.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { MascotCelebrate, MascotPeek } from './Mascot';

// Reduce Motion is read through `useMotion`; mocking it there keeps Reanimated itself untouched.
const mockMotion = { reduced: false };
jest.mock('../theme/motion', () => ({
  ...jest.requireActual('../theme/motion'),
  useMotion: () => ({ reduced: mockMotion.reduced, duration: (ms: number) => ms }),
}));

async function show(node: React.ReactElement) {
  await render(<ThemeProvider preference="dark">{node}</ThemeProvider>);
}

describe.each([false, true])('with Reduce Motion %s', (isReduced) => {
  beforeEach(() => {
    mockMotion.reduced = isReduced;
  });

  it('peeks, hidden from screen readers', async () => {
    await show(<MascotPeek pose="idle" size={104} window={60} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('celebrates, hidden from screen readers', async () => {
    await show(<MascotCelebrate size={136} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk proxy pnpm --filter mobile test -- src/components/Mascot.test.tsx`
Expected: FAIL — `Cannot find module './Mascot'`.

- [x] **Step 3: Write the components**

Create `apps/mobile/src/components/Mascot.tsx`:

```tsx
import { mascot } from '@saldo/ui';
import { useEffect } from 'react';
import { Image, type ImageSourcePropType, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../theme/motion';

// Metro resolves these to asset ids; typed here so nothing downstream sees `any`.
const idle: ImageSourcePropType = require('../../assets/mascot/idle.png');
const success: ImageSourcePropType = require('../../assets/mascot/success.png');
const POSES = { idle, success } as const;

export type MascotPose = keyof typeof POSES;

const OVERSHOOT = Easing.bezier(...mascot.overshootEasing);

/** Decoration (D26): whatever Rocky stands next to already says the same thing. */
const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  pointerEvents: 'none',
} as const;

export interface MascotPeekProps {
  pose: MascotPose;
  /** Rocky's width and height. */
  size: number;
  /** How much of him shows: the window's height, cut at its bottom edge. */
  window: number;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Rocky rising from behind an edge. Place it **before** what he peeks over: React Native paints later siblings on
 * top, and the window cuts him where that sibling begins.
 */
export function MascotPeek({ pose, size, window, delayMs = 0, style }: MascotPeekProps) {
  const { reduced } = useMotion();
  // 1 = still below the edge, 0 = in place.
  const below = useSharedValue(reduced ? 0 : 1);

  useEffect(() => {
    if (reduced) {
      below.set(0);
      return;
    }
    below.set(withDelay(delayMs, withTiming(0, { duration: mascot.peekMs, easing: EASE })));
  }, [reduced, delayMs, below]);

  const rising = useAnimatedStyle(() => ({
    transform: [{ translateY: below.get() * size * mascot.peekFromRatio }],
  }));

  return (
    <View
      testID="mascot"
      {...HIDDEN}
      style={[{ width: size, height: window, overflow: 'hidden' }, style]}
    >
      <Animated.View style={rising}>
        <Image source={POSES[pose]} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

/** Rocky whole, arriving with the app's only overshoot: the close sheet of a reached goal (§6.38). */
export function MascotCelebrate({ size }: { size: number }) {
  const { reduced } = useMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(withTiming(1, { duration: mascot.celebrateMs, easing: OVERSHOOT }));
  }, [reduced, progress]);

  const arriving = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      // Opacity must not overshoot past 1 with the curve, so it is clamped.
      opacity: Math.min(1, p),
      transform: [
        { translateY: interpolate(p, [0, 1], [mascot.celebrateFromY, 0]) },
        { scale: interpolate(p, [0, 1], [mascot.celebrateFromScale, 1]) },
      ],
    };
  });

  return (
    <Animated.View testID="mascot" {...HIDDEN} style={[{ alignSelf: 'center' }, arriving]}>
      <Image source={success} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}
```

If `pnpm typecheck` rejects `require` (it should not: `@types/node` types it and the annotation narrows it), switch
both lines to `import idle from '../../assets/mascot/idle.png'` and add
`apps/mobile/src/assets.d.ts` with `declare module '*.png' { const source: import('react-native').ImageSourcePropType; export default source; }`.

- [x] **Step 4: Run test to verify it passes**

Run: `rtk proxy pnpm --filter mobile test -- src/components/Mascot.test.tsx`
Expected: PASS, 4 tests (2 × Reduce Motion on/off). jest-expo stubs `.png` requires, so no asset loads in tests.

- [x] **Step 5: Lint and typecheck the new file**

Run: `rtk proxy pnpm lint` and `rtk proxy pnpm --filter mobile typecheck`
Expected: no `lint/…` lines, no `× Some errors were emitted`, no `error TS`.

- [x] **Step 6: Commit**

```bash
rtk git add apps/mobile/src/components/Mascot.tsx apps/mobile/src/components/Mascot.test.tsx
rtk git commit -m "feat(mobile): Rocky peeks from behind an edge and celebrates whole"
```

---

## Task 4: Rocky behind the ghost stack

**Files:**
- Modify: `apps/mobile/src/components/EmptyState.tsx` (imports; the `props.kind === 'yet'` branch of `EmptyState`)
- Test: `apps/mobile/src/components/EmptyState.test.tsx`

- [x] **Step 1: Write the failing tests**

Append inside `describe('EmptyState', …)` in `apps/mobile/src/components/EmptyState.test.tsx`:

```tsx
  it('has Rocky peek over the stack for "nothing yet", hidden from screen readers', async () => {
    await renderState({ kind: 'yet', ghost: 'bar', ...copy });
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it.each([
    { kind: 'noMatch', icon: 'search', ...copy },
    { kind: 'notFound', icon: 'inbox', ...copy },
  ] as const)('$kind has no Rocky: frequent, or an error (D26)', async (props) => {
    await renderState(props);
    expect(screen.queryByTestId('mascot', { includeHiddenElements: true })).toBeNull();
  });
```

- [x] **Step 2: Run tests to verify the first fails**

Run: `rtk proxy pnpm --filter mobile test -- src/components/EmptyState.test.tsx`
Expected: FAIL on «has Rocky peek over the stack» (`Unable to find an element with testID: mascot`); the two `$kind has
no Rocky` tests pass already.

- [x] **Step 3: Put Rocky behind the stack**

In `apps/mobile/src/components/EmptyState.tsx`, change the `@saldo/ui` import and add the `Mascot` import:

```tsx
import { emptyState, type IconName, mascot } from '@saldo/ui';
```

```tsx
import { MascotPeek } from './Mascot';
```

Replace:

```tsx
      {props.kind === 'yet' ? (
        <GhostStack kind={props.ghost} pressed={pressed} />
      ) : (
```

with:

```tsx
      {props.kind === 'yet' ? (
        <View style={{ alignItems: 'center' }}>
          {/* Before the stack, so the ghosts paint over him (D26). */}
          <MascotPeek
            pose="idle"
            size={mascot.emptySize}
            window={mascot.emptyWindow}
            delayMs={mascot.emptyDelayMs}
            style={{ marginBottom: -mascot.emptyOverlap }}
          />
          <GhostStack kind={props.ghost} pressed={pressed} />
        </View>
      ) : (
```

- [x] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm --filter mobile test -- src/components/EmptyState.test.tsx`
Expected: PASS, every test in the file (the existing ghost tests are untouched: Rocky is a sibling of the stack, not a
layer of it).

- [x] **Step 5: Commit**

```bash
rtk git add apps/mobile/src/components/EmptyState.tsx apps/mobile/src/components/EmptyState.test.tsx
rtk git commit -m "feat(mobile): Rocky peeks over the nothing-yet ghost stack"
```

---

## Task 5: `GoalCard`, Rocky over a reached goal

**Files:**
- Create: `apps/mobile/src/features/goals/GoalCard.tsx`
- Test: `apps/mobile/src/features/goals/GoalCard.test.tsx`
- Modify: `apps/mobile/app/goals.tsx` (the `views.map` branch), `apps/mobile/app/goal/[id].tsx` (the `<Card>` around
  `FeaturedTarget`)

- [x] **Step 1: Write the failing test**

Create `apps/mobile/src/features/goals/GoalCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { GoalCard } from './GoalCard';

async function show(reached: boolean) {
  await render(
    <ThemeProvider preference="dark">
      <GoalCard reached={reached}>
        <Text>Holiday</Text>
      </GoalCard>
    </ThemeProvider>,
  );
}

describe('GoalCard', () => {
  it('has Rocky peek over a reached goal, hidden from screen readers', async () => {
    await show(true);
    expect(screen.getByText('Holiday')).toBeTruthy();
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('is a plain card for a goal not reached', async () => {
    await show(false);
    expect(screen.getByText('Holiday')).toBeTruthy();
    expect(screen.queryByTestId('mascot', { includeHiddenElements: true })).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals/GoalCard.test.tsx`
Expected: FAIL — `Cannot find module './GoalCard'`.

- [x] **Step 3: Write `GoalCard`**

Create `apps/mobile/src/features/goals/GoalCard.tsx`:

```tsx
import { mascot } from '@saldo/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { MascotPeek } from '../../components/Mascot';

/**
 * A goal's card (§6.35, §6.36). A reached goal has Rocky peeking over its top edge until it is closed (D26): a state,
 * not an event, so it is drawn from `reached` alone.
 */
export function GoalCard({ reached, children }: { reached: boolean; children: ReactNode }) {
  if (!reached) return <Card>{children}</Card>;
  return (
    <View style={{ paddingTop: mascot.cardWindow }}>
      {/* Before the card, so the card paints over him. */}
      <MascotPeek
        pose="success"
        size={mascot.cardSize}
        window={mascot.cardWindow}
        style={{ position: 'absolute', top: 0, end: mascot.cardInset }}
      />
      <Card>{children}</Card>
    </View>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals/GoalCard.test.tsx`
Expected: PASS, 2 tests.

- [x] **Step 5: Use it on the goals list**

In `apps/mobile/app/goals.tsx`, replace the import `import { Card } from '../src/components/Card';` — `Card` is still
used by the closed-goals section, so **keep it** and add:

```tsx
import { GoalCard } from '../src/features/goals/GoalCard';
```

In `views.map(...)`, replace the opening and closing tags

```tsx
          <Card key={view.account.id}>
```

```tsx
          </Card>
```

of that map (only those two; the closed-goals `<Card padded={false}>` stays) with

```tsx
          <GoalCard key={view.account.id} reached={view.progress.state === 'reached'}>
```

```tsx
          </GoalCard>
```

- [x] **Step 6: Use it on the goal's detail**

In `apps/mobile/app/goal/[id].tsx` add:

```tsx
import { GoalCard } from '../../src/features/goals/GoalCard';
```

Replace the `<Card>` … `</Card>` pair that wraps `<FeaturedTarget …/>` (right after `<ScreenHeader …/>`) with
`<GoalCard reached={view.progress.state === 'reached'}>` … `</GoalCard>`. The other two `<Card padded={false}>` in the
file stay, so the `Card` import stays.

- [x] **Step 7: Run the goal tests, lint and typecheck**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals` then `rtk proxy pnpm lint` and
`rtk proxy pnpm --filter mobile typecheck`
Expected: PASS; no `lint/…` lines; no `error TS`.

- [x] **Step 8: Commit**

```bash
rtk git add apps/mobile/src/features/goals/GoalCard.tsx apps/mobile/src/features/goals/GoalCard.test.tsx apps/mobile/app/goals.tsx "apps/mobile/app/goal/[id].tsx"
rtk git commit -m "feat(mobile): Rocky peeks over a reached goal until it is closed"
```

---

## Task 6: Rocky celebrates in the close sheet of a reached goal

**Files:**
- Modify: `apps/mobile/src/features/goals/GoalCloseSheet.tsx`
- Modify: `apps/mobile/app/goal/[id].tsx` (the `<GoalCloseSheet …/>` element)
- Test: `apps/mobile/src/features/goals/GoalCloseSheet.test.tsx`

- [x] **Step 1: Write the failing test**

Create `apps/mobile/src/features/goals/GoalCloseSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { GoalCloseSheet } from './GoalCloseSheet';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

/** `Sheet` reads the bottom inset, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function show(reached: boolean) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <GoalCloseSheet
            visible
            reached={reached}
            onClose={jest.fn()}
            balanceLabel="€3,000.00"
            parentName="Checking"
            onRecordExpense={jest.fn()}
            onReturn={jest.fn()}
          />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('GoalCloseSheet', () => {
  it('celebrates a reached goal with Rocky, hidden from screen readers', async () => {
    await show(true);
    expect(screen.getByText('Did you use the money?')).toBeTruthy();
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('has no Rocky for a goal closed before its target', async () => {
    await show(false);
    expect(screen.getByText('Did you use the money?')).toBeTruthy();
    expect(screen.queryByTestId('mascot', { includeHiddenElements: true })).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals/GoalCloseSheet.test.tsx`
Expected: FAIL — TypeScript/props: the reached case finds no `mascot` testID.

- [x] **Step 3: Add `reached` to the sheet**

In `apps/mobile/src/features/goals/GoalCloseSheet.tsx`:

Add imports:

```tsx
import { mascot } from '@saldo/ui';
import { MascotCelebrate } from '../../components/Mascot';
```

Add to `GoalCloseSheetProps`, after `onClose`:

```tsx
  /** A reached goal opens with Rocky celebrating (§6.38, D26); one closed early does not. */
  reached: boolean;
```

Add `reached,` to the destructured parameters (after `onClose,`), and make the first child of the `<View style={{ gap: 12 }}>`:

```tsx
        {reached ? <MascotCelebrate size={mascot.celebrateSize} /> : null}
```

- [x] **Step 4: Pass it from the goal's detail**

In `apps/mobile/app/goal/[id].tsx`, add to `<GoalCloseSheet` after `onClose={() => setClosing(false)}`:

```tsx
        reached={view.progress.state === 'reached'}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/goals`
Expected: PASS, including the 2 new `GoalCloseSheet` tests.

- [x] **Step 6: Commit**

```bash
rtk git add apps/mobile/src/features/goals/GoalCloseSheet.tsx apps/mobile/src/features/goals/GoalCloseSheet.test.tsx "apps/mobile/app/goal/[id].tsx"
rtk git commit -m "feat(mobile): Rocky celebrates when a reached goal is closed"
```

---

## Task 7: Tune on the simulator and verify

The token values are the mockup's, measured in CSS. The real ghost stack is tilted in perspective, so where its back
edge lands can only be seen on a device.

- [x] **Step 1: Run the app with demo data**

```bash
pnpm --filter mobile seed:db --reset
pnpm --filter mobile ios
```

Open, in dark and in light theme (Profilo › Tema):
1. **Budget** with no budgets (or **Tag** with no tags): Rocky's head and shoulders above the back ghost, nothing of
   him visible through the translucent ghosts. If his chin shows through the back ghost, lower `mascot.emptyOverlap`
   (down to 0); if a gap shows between him and the ghost, raise it. If too little of him shows, raise
   `mascot.emptyWindow` in steps of 4.
2. **Obiettivi** with a reached goal: Rocky over the card's trailing corner, cut exactly at the card's top edge.
3. That goal › **Chiudi obiettivo**: Rocky whole above «Hai usato i soldi?», one small overshoot, no clipping by the
   sheet's handle.
4. Settings › Accessibility › Motion › **Reduce Motion** on: all three appear in place without moving.

Take a screenshot of each (`xcrun simctl io booted screenshot /tmp/rocky-<n>.png`) and look at it.

On device (2026-09-24) the peek cut across his face and floated above the stack: the PNGs carry 18% of empty
margin above the ears, and the tilted stack's visible top edge sits about 35pt below its box. Fixed with
`mascot.trimTop: 0.16`, `emptyOverlap: 41`, `cardSize: 84`, `cardWindow: 48`, and a token test that keeps the cut
below his muzzle.

- [x] **Step 2: Commit any token change**

```bash
rtk git add packages/ui/src/tokens.ts
rtk git commit -m "fix(ui): Rocky's peek measured on device"
```

(Skip if nothing changed.)

- [x] **Step 3: The gates**

Run each through `rtk proxy` and read the output, not the exit code (AGENTS.md):

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines and no `× Some errors were emitted`; no `error TS`; every suite passes.

- [x] **Step 4: Tick this plan's checkboxes and commit**

```bash
rtk git add docs/superpowers/plans/2026-09-24-mascot-states.md
rtk git commit -m "docs(plan): mascot states done"
```

---

## Acceptance criteria

- Every `kind: 'yet'` empty state (budgets, goals, tags, categories, recurrences, transactions) shows Rocky peeking over
  the ghost stack; «nothing matches» and «not found» do not.
- A reached, open goal shows Rocky over its card in the goals list and in its detail; Home does not.
- The close sheet of a reached goal shows Rocky whole; the close sheet of a goal not reached does not.
- Rocky is hidden from VoiceOver/TalkBack everywhere, and with Reduce Motion he appears without moving.
- No new strings, so no i18n changes; no hard-coded sizes or timings outside the `mascot` token.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` clean.
