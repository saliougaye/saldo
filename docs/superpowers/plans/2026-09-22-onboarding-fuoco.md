# Onboarding rework "Fuoco" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the §6.29 onboarding steps one motion language — the old step dissolves in place, the new one arrives chunk by chunk with the title word by word — and one shared header (segments, title, body) instead of five repeated lines per screen.

**Architecture:** The routes stay as they are (`app/(onboarding)/*.tsx`, one screen per step, one draft in `OnboardingProvider`). The `(onboarding)` Stack switches its native transition to a short `fade`, which is the exit; every screen mounts its header and content inside Reanimated `entering` animations, which is the enter. Two new components under `src/features/onboarding/` hold the header (`StepHeader`) and the enter wrapper (`StepChunk`); the durations become `@saldo/ui` tokens and the delays a pure helper in `src/theme/motion.ts`. Progress is drawn as `total` 2px segments (`StepSegments`) rather than a bar; the "Passo n di m" copy becomes the segments' accessibility label.

**Tech Stack:** Expo Router 57 (native-stack `animation: 'fade'`, `animationDuration`), react-native-reanimated 4.5 (`FadeInUp`, `withInitialValues`, `withTiming`), jest-expo + `@testing-library/react-native`, vitest for `@saldo/ui`.

**Chosen in the variants round** (`docs/superpowers/mockups/2026-09-22-onboarding-variants.html`, variant *Fuoco*), with three adjustments agreed with the user: the title keeps `fontSize.display` (34) rather than 44, the balance step is top-aligned like the others (only the chooser is centred in the harness, and the app keeps every step top-aligned for the keyboard), and progress is 2px segments. Deviation from §6.29 "Progress bar 2px": segments, still 2px, still one strip; noted here so the spec row can be updated when the phase closes.

**Out of scope:** the system-permissions step (second bullet of the TODO item), any copy change, the harness's "Tutto pronto" placeholder ("Inizia" still calls `enterTabs`).

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/ui/src/tokens.ts` (modify) | Durations of the step entrance and the segment geometry, as tokens. |
| `packages/ui/src/tokens.test.ts` (modify) | Guards the new tokens' relationships (exit shorter than enter, word stagger shorter than chunk stagger). |
| `apps/mobile/src/theme/motion.ts` (modify) | `stepDelay()` (pure) and `stepEntering()` (Reanimated builder) — the one place the entrance is defined. |
| `apps/mobile/src/theme/stepDelay.test.ts` (create) | Tests the pure delay arithmetic. |
| `apps/mobile/src/features/onboarding/StepSegments.tsx` (create) | The 2px progress segments, animated fill, `progressbar` role. |
| `apps/mobile/src/features/onboarding/StepSegments.test.tsx` (create) | Segment count, accessibility value and label. |
| `apps/mobile/src/features/onboarding/StepHeader.tsx` (create) | Back button, segments, title (word by word), body, plus `StepChunk` for the content below. |
| `apps/mobile/src/features/onboarding/StepHeader.test.tsx` (create) | Header role and name, body, words, segments present/absent. |
| `apps/mobile/app/(onboarding)/_layout.tsx` (modify) | Stack `fade` transition at `stepExitMs`. |
| `apps/mobile/app/(onboarding)/{start,period,account-details,balance,categories,import-currency,import-file,import-balances,welcome}.tsx` (modify) | Use `StepHeader`/`StepChunk`; drop `ProgressBar`, caption and title/body lines. |
| `docs/superpowers/mockups/2026-09-22-onboarding-variants.html` (delete) | Harness, deleted on promotion (variant skill step 6). |
| `TODO.md` (modify) | Tick the rework bullet; the permissions bullet stays. |

---

### Task 1: Motion and segment tokens

**Files:**
- Modify: `packages/ui/src/tokens.ts`
- Modify: `packages/ui/src/tokens.test.ts`

- [x] **Step 1: Write the failing test**

Append to `packages/ui/src/tokens.test.ts`, inside the existing top-level `describe` (or at the end of the file if the tests are flat):

```ts
describe('onboarding step motion', () => {
  it('leaves faster than it arrives, and words follow closer than chunks', () => {
    expect(motion.stepExitMs).toBeLessThan(motion.stepEnterMs);
    expect(motion.stepWordStaggerMs).toBeLessThan(motion.stepChunkStaggerMs);
    // Under 300ms of stagger for a four-chunk step keeps the card tappable before the eye is done
    // reading the title (better-ui: stagger is decorative, never blocking).
    expect(motion.stepChunkStaggerMs * 3).toBeLessThanOrEqual(300);
  });

  it('draws the step segments as a 2px strip (§6.29)', () => {
    expect(layout.stepSegmentHeight).toBe(2);
    expect(layout.stepSegmentGap).toBeGreaterThan(0);
  });
});
```

Make sure `motion` and `layout` are imported at the top of the test file (`import { layout, motion, … } from './tokens';`).

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @saldo/ui test -- --run tokens`
Expected: FAIL — `motion.stepExitMs` is `undefined` (TypeScript will also complain; vitest still runs).

- [x] **Step 3: Add the tokens**

In `packages/ui/src/tokens.ts`, inside `export const motion = { … }`, after `progressMs: 300,`:

```ts
  /**
   * Onboarding steps (§6.29, "Fuoco"): the old step dissolves in place, the new one arrives chunk
   * by chunk — segments, title, body, content — and the title word by word. Seen once, so the
   * entrance may take its time; the exit never does.
   */
  stepEnterMs: 400,
  stepExitMs: 150,
  stepChunkStaggerMs: 100,
  stepWordStaggerMs: 80,
  /** How far a chunk rises while fading in. */
  stepEnterOffset: 12,
```

Inside `export const layout = { … }`, after `progressHeight: 4,`:

```ts
  /** The onboarding progress: one 2px segment per step (§6.29). */
  stepSegmentHeight: 2,
  stepSegmentGap: 6,
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @saldo/ui test -- --run tokens`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
git commit -m "feat(ui): tokens for the onboarding step entrance"
```

---

### Task 2: `stepDelay` and `stepEntering` in `motion.ts`

**Files:**
- Modify: `apps/mobile/src/theme/motion.ts`
- Create: `apps/mobile/src/theme/stepDelay.test.ts`

- [x] **Step 1: Write the failing test**

`apps/mobile/src/theme/stepDelay.test.ts`:

```ts
import { motion } from '@saldo/ui';
import { stepDelay } from './motion';

describe('stepDelay', () => {
  it('staggers chunks by the chunk step', () => {
    expect(stepDelay(0)).toBe(0);
    expect(stepDelay(2)).toBe(2 * motion.stepChunkStaggerMs);
  });

  it('staggers words inside a chunk by the word step, after the chunk delay', () => {
    expect(stepDelay(1, 0)).toBe(motion.stepChunkStaggerMs);
    expect(stepDelay(1, 3)).toBe(motion.stepChunkStaggerMs + 3 * motion.stepWordStaggerMs);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @saldo/mobile test -- --selectProjects app --testPathPatterns stepDelay`
Expected: FAIL — `stepDelay` is not exported from `./motion`.

- [x] **Step 3: Implement**

In `apps/mobile/src/theme/motion.ts`, add `FadeInUp` to the existing import from `react-native-reanimated` (it is already there — check; if it is, leave the import alone), then append after `reflowing`:

```ts
/** When the `chunk`-th block of an onboarding step — or its `word`-th word — starts arriving. */
export function stepDelay(chunk: number, word?: number): number {
  return chunk * motion.stepChunkStaggerMs + (word ?? 0) * motion.stepWordStaggerMs;
}

/**
 * A block of an onboarding step arriving (§6.29): rises `stepEnterOffset` while fading in, later
 * blocks later. Reduce Motion skips to the end state, and the fade transition of the Stack is the
 * only exit, so nothing here has a leaving counterpart.
 */
export function stepEntering(chunk: number, word?: number) {
  return FadeInUp.duration(motion.stepEnterMs)
    .delay(stepDelay(chunk, word))
    .easing(EASE)
    .withInitialValues({ opacity: 0, transform: [{ translateY: motion.stepEnterOffset }] })
    .reduceMotion(ReduceMotion.System);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @saldo/mobile test -- --selectProjects app --testPathPatterns stepDelay`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/theme/motion.ts apps/mobile/src/theme/stepDelay.test.ts
git commit -m "feat(mobile): stepEntering, the onboarding block entrance"
```

---

### Task 3: `StepSegments`

**Files:**
- Create: `apps/mobile/src/features/onboarding/StepSegments.tsx`
- Create: `apps/mobile/src/features/onboarding/StepSegments.test.tsx`

- [x] **Step 1: Write the failing test**

`apps/mobile/src/features/onboarding/StepSegments.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { StepSegments } from './StepSegments';

describe('StepSegments', () => {
  it('is one progressbar labelled with the step, worth current of total', async () => {
    await render(
      <ThemeProvider preference="dark">
        <StepSegments current={2} total={4} label="Passo 2 di 4" />
      </ThemeProvider>,
    );
    const bar = screen.getByRole('progressbar', { name: 'Passo 2 di 4' });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 4, now: 2 });
  });

  it('draws one segment per step', async () => {
    await render(
      <ThemeProvider preference="dark">
        <StepSegments current={1} total={4} label="Passo 1 di 4" />
      </ThemeProvider>,
    );
    expect(screen.getAllByTestId('step-segment', { includeHiddenElements: true })).toHaveLength(4);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @saldo/mobile test -- --selectProjects app --testPathPatterns StepSegments`
Expected: FAIL — cannot find module `./StepSegments`.

- [x] **Step 3: Implement**

`apps/mobile/src/features/onboarding/StepSegments.tsx`:

```tsx
import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE, useMotion } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';

export interface StepSegmentsProps {
  /** 1-based step number. */
  current: number;
  total: number;
  /** The "Passo n di m" copy: the segments are the visible progress, this is the spoken one. */
  label: string;
}

/**
 * §6.29 progress: one 2px segment per step, the done ones and the current one filled. A separate
 * segment per step rather than one bar so the eye counts steps left without reading a number.
 */
export function StepSegments({ current, total, label }: StepSegmentsProps) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: current }}
      style={{ flexDirection: 'row', gap: theme.layout.stepSegmentGap }}
    >
      {Array.from({ length: total }, (_, index) => (
        <Segment key={index} filled={index < current} />
      ))}
    </View>
  );
}

function Segment({ filled }: { filled: boolean }) {
  const theme = useTheme();
  const { reduced } = useMotion();
  // `scaleX` from the left edge, as in `ProgressBar`: a transform, not a width, so no layout per frame.
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    const target = filled ? 1 : 0;
    fill.value = reduced ? target : withTiming(target, { duration: motion.progressMs, easing: EASE });
  }, [filled, reduced, fill]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View
      testID="step-segment"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        flex: 1,
        height: theme.layout.stepSegmentHeight,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.track,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            transformOrigin: 'left',
            backgroundColor: theme.palette.accent,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @saldo/mobile test -- --selectProjects app --testPathPatterns StepSegments`
Expected: PASS (2 tests).

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/features/onboarding/StepSegments.tsx apps/mobile/src/features/onboarding/StepSegments.test.tsx
git commit -m "feat(mobile): StepSegments, the onboarding progress"
```

---

### Task 4: `StepHeader` and `StepChunk`

**Files:**
- Create: `apps/mobile/src/features/onboarding/StepHeader.tsx`
- Create: `apps/mobile/src/features/onboarding/StepHeader.test.tsx`

- [x] **Step 1: Write the failing test**

`apps/mobile/src/features/onboarding/StepHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { StepChunk, StepHeader } from './StepHeader';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));

function wrap(node: React.ReactNode) {
  return <ThemeProvider preference="dark">{node}</ThemeProvider>;
}

describe('StepHeader', () => {
  it('announces the whole title as one header while drawing it word by word', async () => {
    await render(
      wrap(
        <StepHeader
          step={{ current: 2, total: 4 }}
          title="Il tuo primo conto"
          body="Puoi aggiungerne altri quando vuoi."
        />,
      ),
    );
    expect(screen.getByRole('header', { name: 'Il tuo primo conto' })).toBeTruthy();
    expect(screen.getAllByTestId('step-word', { includeHiddenElements: true })).toHaveLength(4);
    expect(screen.getByText('Puoi aggiungerne altri quando vuoi.')).toBeTruthy();
  });

  it('shows the segments only for a numbered step', async () => {
    await render(
      wrap(<StepHeader step={{ current: 1, total: 4 }} title="Come segui le spese?" body="Scegli." />),
    );
    expect(screen.getByRole('progressbar', { name: 'Passo 1 di 4' })).toBeTruthy();
    screen.unmount();
    await render(wrap(<StepHeader title="Come vuoi iniziare?" body="Da zero o no." />));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('StepChunk renders its children', async () => {
    await render(
      wrap(
        <StepChunk index={2}>
          <StepHeader title="X" body="Y" />
        </StepChunk>,
      ),
    );
    expect(screen.getByRole('header', { name: 'X' })).toBeTruthy();
  });
});
```

The component reads the "Passo n di m" copy through `react-i18next`. Check how other `src/features/**/*.test.tsx` files get translations (search for `i18n` in an existing feature test, e.g. `grep -rl "initI18n\|i18n" apps/mobile/src --include=*.test.tsx | head -3`) and copy that setup at the top of this test; if none initialises i18n and `t` returns the key, assert `name: 'onboarding.step'` instead and say so in a comment.

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @saldo/mobile test -- --selectProjects app --testPathPatterns StepHeader`
Expected: FAIL — cannot find module `./StepHeader`.

- [x] **Step 3: Implement**

`apps/mobile/src/features/onboarding/StepHeader.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { BackButton } from '../../components/ScreenHeader';
import { stepEntering } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { StepSegments } from './StepSegments';

/** The blocks of a step, in the order they arrive. Content below the header starts at `CONTENT`. */
export const CHUNK = { segments: 0, title: 1, body: 2, content: 3 } as const;

export interface StepHeaderProps {
  /** Omitted on the chooser and the welcome screen, which are not numbered (§6.29). */
  step?: { current: number; total: number };
  title: string;
  body: string;
  /** Hides the back affordance where the screen is the first of its stack. */
  back?: boolean;
}

/**
 * The top of every onboarding screen (§6.29): back, the 2px segments, the title one word at a
 * time, the body. Each block arrives after the previous one; the Stack's fade takes the old
 * screen away. Pair with {@link StepChunk} for the content underneath.
 */
export function StepHeader({ step, title, body, back = true }: StepHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const words = title.split(' ');
  const size = theme.fontSize.display;
  return (
    <View style={{ gap: 12 }}>
      {back ? <BackButton /> : null}
      {step === undefined ? null : (
        <Animated.View entering={stepEntering(CHUNK.segments)}>
          <StepSegments
            current={step.current}
            total={step.total}
            label={t('onboarding.step', { current: step.current, total: step.total })}
          />
        </Animated.View>
      )}
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={title}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          // A word's worth of space, at this size: the words are laid out by the row, not by the text.
          columnGap: Math.round(size * 0.24),
          marginTop: step === undefined ? 12 : 4,
        }}
      >
        {words.map((word, index) => (
          <Animated.View
            // Words repeat ("il", "di"); the position is the identity.
            key={`${index}-${word}`}
            testID="step-word"
            entering={stepEntering(CHUNK.title, index)}
          >
            <Text size="display" weight="semibold" tracking="tighter">
              {word}
            </Text>
          </Animated.View>
        ))}
      </View>
      <Animated.View entering={stepEntering(CHUNK.body)}>
        <Text color="textMuted">{body}</Text>
      </Animated.View>
    </View>
  );
}

export interface StepChunkProps {
  /** Position in the entrance; content starts at `CHUNK.content`. */
  index?: number;
  children: ReactNode;
}

/** A block of step content arriving after the header. */
export function StepChunk({ index = CHUNK.content, children }: StepChunkProps) {
  return <Animated.View entering={stepEntering(index)}>{children}</Animated.View>;
}
```

Note on `Text` and `tracking`: `Text` applies `letterSpacing` per word, which is what the single-line title did too, so the measure is unchanged.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @saldo/mobile test -- --selectProjects app --testPathPatterns StepHeader`
Expected: PASS (3 tests). If `getByRole('header', { name })` fails because the row is not treated as accessible, confirm `accessible` is set on the row (it is required for the label to name the group).

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/features/onboarding/StepHeader.tsx apps/mobile/src/features/onboarding/StepHeader.test.tsx
git commit -m "feat(mobile): StepHeader, the onboarding step header that arrives in blocks"
```

---

### Task 5: The Stack dissolves between steps

**Files:**
- Modify: `apps/mobile/app/(onboarding)/_layout.tsx`

- [x] **Step 1: Change the transition**

Replace the file's content with:

```tsx
import { motion } from '@saldo/ui';
import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../src/features/onboarding/state';

/**
 * The steps share one draft; nothing is written until "Inizia" (§6.29). They also share one
 * motion: the screen leaving dissolves in place — no push, the steps are not a place the user
 * walks through — and the one arriving builds itself block by block (`StepHeader`).
 */
export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          // iOS only honours this for fade-type transitions, which is the one used here.
          animationDuration: motion.stepExitMs,
        }}
      />
    </OnboardingProvider>
  );
}
```

- [x] **Step 2: Typecheck**

Run: `pnpm --filter @saldo/mobile typecheck`
Expected: no errors. (If `animationDuration` is not in the option type of the installed `react-native-screens`, remove that line and keep `animation: 'fade'`; note it in the commit body.)

- [x] **Step 3: Commit**

```bash
git add "apps/mobile/app/(onboarding)/_layout.tsx"
git commit -m "feat(mobile): onboarding steps dissolve instead of pushing"
```

---

### Task 6: Fresh path screens use `StepHeader`

**Files:**
- Modify: `apps/mobile/app/(onboarding)/start.tsx`
- Modify: `apps/mobile/app/(onboarding)/period.tsx`
- Modify: `apps/mobile/app/(onboarding)/account-details.tsx`
- Modify: `apps/mobile/app/(onboarding)/balance.tsx`
- Modify: `apps/mobile/app/(onboarding)/categories.tsx`

Same edit in each: remove the `BackButton`, `ProgressBar`, `Text` caption/title/body block; render `StepHeader`; wrap each content `Card` (and the categories count caption) in `StepChunk`, incrementing the index per block. Remove the imports that fall unused (`ProgressBar`, `BackButton`, and `Text` where nothing else uses it — `period.tsx` and `categories.tsx` still use `Text` inside cards; check before deleting).

- [x] **Step 1: `start.tsx`**

Replace the header block

```tsx
      <View style={{ paddingTop: 24, gap: 12 }}>
        <Text size="display" weight="semibold" tracking="tighter">
          {t('onboarding.startTitle')}
        </Text>
        <Text color="textMuted">{t('onboarding.startBody')}</Text>
      </View>
```

with

```tsx
      <StepHeader back={false} title={t('onboarding.startTitle')} body={t('onboarding.startBody')} />
```

and wrap the `<Card padded={false}>…</Card>` in `<StepChunk>…</StepChunk>`. Imports: add `import { StepChunk, StepHeader } from '../../src/features/onboarding/StepHeader';`; remove `Text` if unused (it is: delete the import). `back={false}`: the chooser is the first screen after sign-in; there is nothing to go back to and `BackButton` would return `null` anyway, but the intent is clearer stated.

- [x] **Step 2: `period.tsx`**

Replace

```tsx
      <BackButton />
      <ProgressBar ratio={1 / 4} />
      <Text size="caption" color="textFaint">
        {t('onboarding.step', { current: 1, total: 4 })}
      </Text>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('onboarding.periodTitle')}
      </Text>
      <Text color="textMuted">{t('onboarding.periodBody')}</Text>
```

with

```tsx
      <StepHeader
        step={{ current: 1, total: 4 }}
        title={t('onboarding.periodTitle')}
        body={t('onboarding.periodBody')}
      />
```

Wrap the kinds `<Card padded={false}>` in `<StepChunk>`; wrap the conditional cycle card in `<StepChunk index={CHUNK.content + 1}>` **inside** the `kind === 'cycle' ? (…) : null` so it also animates in when the pay cycle is picked; wrap the timeline `Text`/`Card` that follows (read the rest of the file: whatever renders `onboarding.periodTimeline`) in `<StepChunk index={CHUNK.content + 2}>`. Import `CHUNK, StepChunk, StepHeader`.

- [x] **Step 3: `account-details.tsx`**

Replace the five-line block (`BackButton`, `ProgressBar ratio={2 / 4}`, caption, title, body) with

```tsx
      <StepHeader
        step={{ current: 2, total: 4 }}
        title={t('onboarding.accountTitle')}
        body={t('onboarding.accountBody')}
      />
```

and wrap the `<Card>` in `<StepChunk>`. `TextField` has `autoFocus`: keep it — the keyboard rising during the entrance is the iOS behaviour on every form and the chunk is on screen at `stepDelay(3) = 300ms`, well inside the keyboard's own animation.

- [x] **Step 4: `balance.tsx`**

Replace the header block (`ratio={3 / 4}`, `current: 3`) with

```tsx
      <StepHeader
        step={{ current: 3, total: 4 }}
        title={t('onboarding.balanceTitle')}
        body={t('onboarding.balanceBody')}
      />
```

Wrap the amount `<Card>` in `<StepChunk>` and the currency `<Card>` in `<StepChunk index={CHUNK.content + 1}>`.

- [x] **Step 5: `categories.tsx`**

Replace the header block (`ratio={1}`, `current: 4`) with

```tsx
      <StepHeader
        step={{ current: 4, total: 4 }}
        title={t('onboarding.categoriesTitle')}
        body={t('onboarding.categoriesBody')}
      />
```

Wrap the `categoriesSelected` caption `Text` in `<StepChunk>` and the grid `<Card>` in `<StepChunk index={CHUNK.content + 1}>`.

- [x] **Step 6: Lint, typecheck, tests**

Run: `rtk proxy pnpm lint && pnpm --filter @saldo/mobile typecheck && pnpm --filter @saldo/mobile test -- --selectProjects app`
Expected: no `lint/…` lines, no type errors, tests green. Unused-import errors from Biome point at the `Text`/`View` imports to delete.

- [x] **Step 7: Commit**

```bash
git add "apps/mobile/app/(onboarding)/start.tsx" "apps/mobile/app/(onboarding)/period.tsx" "apps/mobile/app/(onboarding)/account-details.tsx" "apps/mobile/app/(onboarding)/balance.tsx" "apps/mobile/app/(onboarding)/categories.tsx"
git commit -m "feat(mobile): the fresh onboarding path arrives block by block"
```

---

### Task 7: Import path and welcome use `StepHeader`

**Files:**
- Modify: `apps/mobile/app/(onboarding)/import-currency.tsx`
- Modify: `apps/mobile/app/(onboarding)/import-file.tsx`
- Modify: `apps/mobile/app/(onboarding)/import-balances.tsx`
- Modify: `apps/mobile/app/(onboarding)/welcome.tsx`

- [x] **Step 1: `import-currency.tsx`**

Replace the header block (`ratio={2 / 4}`, `current: 2`, `importCurrencyTitle`, `importCurrencyBody`) with

```tsx
      <StepHeader
        step={{ current: 2, total: 4 }}
        title={t('onboarding.importCurrencyTitle')}
        body={t('onboarding.importCurrencyBody')}
      />
```

and wrap the content card(s) in `StepChunk` (first at default index, any second at `CHUNK.content + 1`).

- [x] **Step 2: `import-file.tsx`**

Header: `step={{ current: 3, total: 4 }}`, `importFileTitle`, `importFileBody`. The screen renders `ImportWizard` below: wrap it in `<StepChunk>`. `ImportWizard` is also rendered from `profile/import`, which is not onboarding; leave the wizard itself untouched.

- [x] **Step 3: `import-balances.tsx`**

Header: `step={{ current: 4, total: 4 }}`, `importBalancesTitle`, `importBalancesBody`. Wrap the per-account list (whatever renders the rows — read the file; it is one `Card` or a `View` of cards) in `<StepChunk>`. If it maps accounts to cards, wrap the container once rather than each row: rows are data, not blocks.

- [x] **Step 4: `welcome.tsx`**

Replace

```tsx
        <View style={{ paddingTop: 24, gap: 12 }}>
          <Text size="display" weight="semibold" tracking="tighter">
            {t('onboarding.welcomeTitle')}
          </Text>
          <Text color="textMuted">{t('onboarding.welcomeBody')}</Text>
        </View>
```

with

```tsx
        <StepHeader
          back={false}
          title={t('onboarding.welcomeTitle')}
          body={t('onboarding.welcomeBody')}
        />
```

and wrap the `<Card>` holding `ConnectForm` in `<StepChunk>` and the offline caption in `<StepChunk index={CHUNK.content + 1}>`. `Text` stays imported (the caption uses it). Note: the title is one word ("Saldo"); the word split degrades to one block, which is fine.

- [x] **Step 5: Lint, typecheck, tests**

Run: `rtk proxy pnpm lint && pnpm --filter @saldo/mobile typecheck && pnpm --filter @saldo/mobile test -- --selectProjects app`
Expected: clean.

- [x] **Step 6: Commit**

```bash
git add "apps/mobile/app/(onboarding)/import-currency.tsx" "apps/mobile/app/(onboarding)/import-file.tsx" "apps/mobile/app/(onboarding)/import-balances.tsx" "apps/mobile/app/(onboarding)/welcome.tsx"
git commit -m "feat(mobile): import path and welcome share the step header"
```

---

### Task 8: Promote, clean up, verify

**Files:**
- Delete: `docs/superpowers/mockups/2026-09-22-onboarding-variants.html`
- Modify: `TODO.md:103-106`
- Check: `apps/mobile/src/components/ProgressBar.tsx` still has callers (budgets); do **not** delete it.

- [x] **Step 1: Delete the harness**

```bash
git rm docs/superpowers/mockups/2026-09-22-onboarding-variants.html
```

- [x] **Step 2: Tick the rework bullet in `TODO.md`**

Change

```markdown
- [x] Rework the onboarding screens (§6.29). Today they follow the prototype's step layout (1616–1717) and have not
      had a design pass since; scope the redesign before planning it.
```

to

```markdown
- [x] Rework the onboarding screens (§6.29) — done as "Fuoco" (`docs/superpowers/plans/2026-09-22-onboarding-fuoco.md`):
      the old step dissolves, the new one arrives block by block, progress is 2px segments.
```

The permissions bullet and the "Open points" paragraph stay as they are.

- [x] **Step 3: Full gates, read the output not the exit code**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `pnpm typecheck`
Expected: every package/app passes.

Run: `rtk proxy pnpm test`
Expected: every project green, including `@saldo/i18n`'s parity test (no strings were added, so it cannot move) and `apps/mobile` `db` + `app`.

- [x] **Step 4: Commit**

```bash
git add -A docs/superpowers/mockups TODO.md
git commit -m "chore: promote the Fuoco onboarding, drop the variants harness"
```

- [x] **Step 5: Hand back**

Stop. The user checks the flow on the simulator themselves (memory: no emulator runs by Claude). Things worth looking at there, in order: the title wrap at 34pt on `categoriesTitle`; the keyboard rising under the balance step while its blocks are still arriving; Reduce Motion on (Settings → Accessibility → Motion) leaves every block visible at once.

---

## Self-review

- **Spec coverage.** §6.29 steps, order, copy, "Inizia" behaviour: untouched. "Progress bar 2px": segments, 2px, deviation stated in the header. Step 0 welcome "same visual language: 32px title, muted body": `display` is 34 today already; unchanged by this plan.
- **Placeholders.** None: every screen edit shows the replacement JSX; the only "read the file" instructions name what to find (`periodTimeline`, the balances container) because the current code there is not reproduced in this plan and must not be guessed.
- **Type consistency.** `stepEntering(chunk, word?)` (Task 2) is what `StepHeader` calls (Task 4); `CHUNK.content` is exported from `StepHeader.tsx` and imported in Tasks 6–7 as `CHUNK`; `StepSegments` props `{ current, total, label }` match Task 4's call; tokens `stepEnterMs/stepExitMs/stepChunkStaggerMs/stepWordStaggerMs/stepEnterOffset/stepSegmentHeight/stepSegmentGap` are the names used everywhere.
