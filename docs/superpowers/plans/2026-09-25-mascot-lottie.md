# Mascot as Lottie states Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rocky moves as the mascot kit's Lottie states, in the three places he already has and in four new ones:
waving on the welcome, asleep on the lock screen, waiting in a long labelled load, and small above a failed import or
restore (spec D26, §13 *Mascot*, §6.29, §6.32).

**Architecture:** The kit's six Lottie JSONs live in `apps/mobile/assets/mascot/`. A pure rule,
`mascotPlayback(state, frames, reduced)`, decides loop / play once to the pose frame / hold the pose frame. One
component, `Mascot` in `src/components/Mascot.tsx`, turns that rule into a `LottieView`; `MascotPeek`,
`MascotCelebrate`, the new `ErrorNote`, `LoadingScreen`, the welcome and the lock screen all render a `Mascot`. Sizes
live in the `mascot` token of `@saldo/ui`.

**Tech Stack:** `lottie-react-native` ~7.3.8 (the version Expo SDK 57 bundles), Reanimated 4 (unchanged rise and
arrival), jest-expo + React Native Testing Library, Vitest for `@saldo/ui`.

**Source of the animations:** github.com/saliougaye/mascots (private) at `a1ac4fe`, `out/saldo/animations/`. Pose
frames come from the kit's spec (`mascots/saldo/mascot.spec.json`, `pose_time`, else 60% of the loop) at 30 fps.

**Decisions taken while planning (spec silent):**
- **Rocky on the welcome sits at the start edge**, above a left-aligned title, not centred. Checked on device in Task 8;
  if he reads better centred, change `alignSelf` there and note it here.
- **`ErrorNote` centres Rocky and the message.** The two screens had the message left-aligned under their content; a
  small figure above a left-aligned line would hang off its start edge, so both are centred.
- **Screens get no new tests** (there are no screen tests in this app; `jest.config.js` only matches `src/`). The
  components they now render (`ErrorNote`, `LoadingScreen`, `Mascot`) are tested, and the screens are checked on the
  simulator in Task 8.
- **`success` stops mid-hop** (its pose frame), like the PNG it replaces. If it looks frozen on device, Task 8 moves
  its pose to the last frame and records it here and in §13.
- **Checked on the iOS simulator (2026-09-26)** by the user: the welcome alignment, the centred `ErrorNote`, `success`
  mid-hop and every size stay as planned; nothing changed.

---

## File structure

| File | Responsibility |
|---|---|
| `apps/mobile/assets/mascot/{idle,success,error,wave,loading,sleep}.json` | The kit's Lottie states (copied, never edited) |
| `apps/mobile/src/components/mascotPlayback.ts` | Pure rule: which states loop, each pose frame, Reduce Motion |
| `apps/mobile/src/components/mascotPlayback.test.ts` | Tests of the rule, against the real JSONs |
| `apps/mobile/src/components/Mascot.tsx` | `Mascot` (new), `MascotPeek` and `MascotCelebrate` rendering it |
| `apps/mobile/src/components/ErrorNote.tsx` | Rocky `error` above an inline error message |
| `apps/mobile/src/components/LoadingScreen.tsx` | Rocky `loading` instead of the spinner when labelled |
| `apps/mobile/jest.setup.js` | Mock of `lottie-react-native` (a native view) |
| `packages/ui/src/tokens.ts` | `mascot.welcomeSize`, `lockSize`, `loadingSize`, `errorSize` |
| `apps/mobile/app/(onboarding)/welcome.tsx`, `app/lock.tsx`, `app/profile/import.tsx`, `app/profile/restore.tsx` | Call sites |
| `biome.json` | Keep Biome off the kit's JSON |

---

### Task 1: Dependency, animations, Biome and the jest mock

**Files:**
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml` (via `expo install`)
- Create: `apps/mobile/assets/mascot/{idle,success,error,wave,loading,sleep}.json`
- Modify: `biome.json` (`files.includes`)
- Modify: `apps/mobile/jest.setup.js`

- [x] **Step 1: Install the library at the version Expo pins**

```bash
cd apps/mobile && npx expo install lottie-react-native
grep '"lottie-react-native"' package.json
```
Expected: `"lottie-react-native": "~7.3.8"` (or whatever `expo/bundledNativeModules.json` lists; use that).

- [x] **Step 2: Copy the six states from the kit**

```bash
cd apps/mobile/assets/mascot
for s in idle success error wave loading sleep; do
  gh api -H 'Accept: application/vnd.github.raw' \
    "repos/saliougaye/mascots/contents/out/saldo/animations/$s.json?ref=a1ac4fe" > "$s.json"
done
python3 -c "
import json
for s in ['idle','success','error','wave','loading','sleep']:
    d = json.load(open(f'{s}.json')); print(s, d['fr'], d['op'] - d['ip'], d['w'], d['h'], len(d['assets']))"
```
Expected, one line each: `idle 30 144 512 512 0`, `success 30 72 …`, `error 30 72 …`, `wave 30 144 …`,
`loading 30 144 …`, `sleep 30 144 …`. Zero assets: vector only.

- [x] **Step 3: Keep Biome off them**

In `biome.json`, `files.includes`, add after `"!apps/mobile/drizzle",`:

```json
      "!apps/mobile/assets/mascot",
```

Run: `rtk proxy pnpm lint` from the repo root. Expected: no `lint/…` lines, no `× Some errors were emitted`.

- [x] **Step 4: Mock the native view in jest**

Replace `apps/mobile/jest.setup.js` with:

```js
require('react-native-gesture-handler/jestSetup');

// `lottie-react-native` is a native view. Tests only need something in its place, and the
// imperative API `Mascot` calls.
jest.mock('lottie-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  class LottieView extends React.Component {
    play() {}
    reset() {}
    pause() {}
    resume() {}
    render() {
      return React.createElement(View, { testID: 'lottie', style: this.props.style });
    }
  }
  return { __esModule: true, default: LottieView };
});
```

- [x] **Step 5: Run the gates**

```bash
cd ../.. && rtk proxy pnpm typecheck && rtk proxy pnpm --filter mobile test
```
Expected: typecheck clean; every suite passes (nothing uses the library yet).

- [x] **Step 6: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/assets/mascot/*.json biome.json apps/mobile/jest.setup.js
git commit -m "chore(mobile): lottie-react-native and Rocky's Lottie states from the mascot kit"
```

---

### Task 2: The playback rule

**Files:**
- Create: `apps/mobile/src/components/mascotPlayback.ts`
- Test: `apps/mobile/src/components/mascotPlayback.test.ts`

- [x] **Step 1: Write the failing test**

`apps/mobile/src/components/mascotPlayback.test.ts`:

```ts
import { MASCOT_STATES, type MascotState, mascotPlayback, POSE_FRAME } from './mascotPlayback';

// The real files: a pose frame outside its animation would hold Rocky on nothing.
const FILES: Record<MascotState, { ip: number; op: number }> = {
  idle: require('../../assets/mascot/idle.json'),
  success: require('../../assets/mascot/success.json'),
  error: require('../../assets/mascot/error.json'),
  wave: require('../../assets/mascot/wave.json'),
  loading: require('../../assets/mascot/loading.json'),
  sleep: require('../../assets/mascot/sleep.json'),
};

describe('mascotPlayback', () => {
  it.each(['loading', 'sleep'] as const)('loops %s: those are waits', (state) => {
    expect(mascotPlayback(state, 144, false)).toEqual({ kind: 'loop' });
  });

  it.each(['idle', 'success', 'error', 'wave'] as const)(
    'plays %s once and stops on its pose',
    (state) => {
      expect(mascotPlayback(state, 144, false)).toEqual({
        kind: 'once',
        endFrame: POSE_FRAME[state],
      });
    },
  );

  it.each(MASCOT_STATES)('holds %s on its pose under Reduce Motion, loops included', (state) => {
    expect(mascotPlayback(state, 144, true)).toEqual({
      kind: 'still',
      progress: POSE_FRAME[state] / 144,
    });
  });

  it.each(MASCOT_STATES)('finds the pose of %s inside its animation', (state) => {
    const file = FILES[state];
    expect(POSE_FRAME[state]).toBeGreaterThan(0);
    expect(POSE_FRAME[state]).toBeLessThan(file.op - file.ip);
  });
});
```

- [x] **Step 2: Run it to see it fail**

Run: `cd apps/mobile && npx jest src/components/mascotPlayback.test.ts`
Expected: FAIL, `Cannot find module './mascotPlayback'`.

- [x] **Step 3: Write the rule**

`apps/mobile/src/components/mascotPlayback.ts`:

```ts
/** The kit's states Saldo uses (§13 *Mascot*). */
export const MASCOT_STATES = ['idle', 'success', 'error', 'wave', 'loading', 'sleep'] as const;
export type MascotState = (typeof MASCOT_STATES)[number];

/**
 * The frame each state's still is cut from: the kit's `pose_time` (60% of the loop unless its spec
 * sets one) at 30 fps. A Rocky who stops is the kit's still.
 */
export const POSE_FRAME: Record<MascotState, number> = {
  idle: 86,
  success: 43,
  error: 43,
  wave: 45,
  loading: 86,
  sleep: 42,
};

/** Only the waits loop: a Rocky moving for ever beside an empty list is noise. */
const LOOPS: ReadonlySet<MascotState> = new Set(['loading', 'sleep']);

export type MascotPlayback =
  | { kind: 'loop' }
  | { kind: 'once'; endFrame: number }
  | { kind: 'still'; progress: number };

/** How `state` plays in an animation of `frames` frames. Reduce Motion plays nothing. */
export function mascotPlayback(state: MascotState, frames: number, reduced: boolean): MascotPlayback {
  if (reduced) return { kind: 'still', progress: POSE_FRAME[state] / frames };
  if (LOOPS.has(state)) return { kind: 'loop' };
  return { kind: 'once', endFrame: POSE_FRAME[state] };
}
```

- [x] **Step 4: Run it to see it pass**

Run: `npx jest src/components/mascotPlayback.test.ts`
Expected: PASS, 18 tests.

- [x] **Step 5: Commit**

```bash
git add src/components/mascotPlayback.ts src/components/mascotPlayback.test.ts
git commit -m "feat(mobile): which of Rocky's states loop and where each one stops"
```

---

### Task 3: `Mascot`, and the peek and celebration on top of it

**Files:**
- Modify: `apps/mobile/src/components/Mascot.tsx`
- Modify: `apps/mobile/src/components/EmptyState.tsx:64-70` (`pose` → `state`)
- Modify: `apps/mobile/src/features/goals/GoalCard.tsx:16-21` (`pose` → `state`)
- Delete: `apps/mobile/assets/mascot/idle.png`, `apps/mobile/assets/mascot/success.png`
- Test: `apps/mobile/src/components/Mascot.test.tsx`

- [x] **Step 1: Write the failing test**

Replace `apps/mobile/src/components/Mascot.test.tsx` with:

```tsx
import { mascot } from '@saldo/ui';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { Mascot, MascotCelebrate, MascotPeek } from './Mascot';
import { MASCOT_STATES } from './mascotPlayback';

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

  it.each(MASCOT_STATES)('draws %s, hidden from screen readers', async (state) => {
    await show(<Mascot state={state} size={64} />);
    expect(screen.getByTestId(`mascot-${state}`, { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId(`mascot-${state}`)).toBeNull();
  });

  it('peeks, hidden from screen readers', async () => {
    await show(<MascotPeek state="idle" size={mascot.emptySize} window={mascot.emptyWindow} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('mascot-idle', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });

  it('celebrates, hidden from screen readers', async () => {
    await show(<MascotCelebrate size={mascot.celebrateSize} />);
    expect(screen.getByTestId('mascot', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('mascot-success', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('mascot')).toBeNull();
  });
});
```

- [x] **Step 2: Run it to see it fail**

Run: `npx jest src/components/Mascot.test.tsx`
Expected: FAIL, `Mascot` is not exported (and `state` is not a prop of `MascotPeek`).

- [x] **Step 3: Rewrite `Mascot.tsx`**

Replace the top of `apps/mobile/src/components/Mascot.tsx` down to (and including) `export type MascotPose = …;`
with:

```tsx
import { mascot } from '@saldo/ui';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../theme/motion';
import { type MascotState, mascotPlayback } from './mascotPlayback';

export type { MascotState } from './mascotPlayback';

// The mascot kit's Lottie states (§13 *Mascot*), typed here so nothing downstream sees `any`.
const SOURCES: Record<MascotState, AnimationObject> = {
  idle: require('../../assets/mascot/idle.json'),
  success: require('../../assets/mascot/success.json'),
  error: require('../../assets/mascot/error.json'),
  wave: require('../../assets/mascot/wave.json'),
  loading: require('../../assets/mascot/loading.json'),
  sleep: require('../../assets/mascot/sleep.json'),
};

const frames = (source: AnimationObject) => source.op - source.ip;
```

Keep `OVERSHOOT` and `HIDDEN` as they are. Directly after `HIDDEN`, add:

```tsx
export interface MascotProps {
  state: MascotState;
  /** Rocky's width and height: the kit's square canvas. */
  size: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One of the kit's states: `loading` and `sleep` loop, the others play once and stop on their pose,
 * and Reduce Motion holds the pose without playing (`mascotPlayback`).
 */
export function Mascot({ state, size, style }: MascotProps) {
  const { reduced } = useMotion();
  const ref = useRef<LottieView>(null);
  const source = SOURCES[state];
  const playback = mascotPlayback(state, frames(source), reduced);

  useEffect(() => {
    const next = mascotPlayback(state, frames(SOURCES[state]), reduced);
    if (next.kind === 'loop') ref.current?.play();
    if (next.kind === 'once') ref.current?.play(0, next.endFrame);
  }, [state, reduced]);

  return (
    <View testID={`mascot-${state}`} {...HIDDEN} style={[{ width: size, height: size }, style]}>
      <LottieView
        ref={ref}
        source={source}
        autoPlay={false}
        loop={playback.kind === 'loop'}
        progress={playback.kind === 'still' ? playback.progress : undefined}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}
```

In `MascotPeekProps`, replace `pose: MascotPose;` with `state: MascotState;`. In `MascotPeek`, change the
destructuring `{ pose, size, window, delayMs = 0, style }` to `{ state, size, window, delayMs = 0, style }`, and
replace

```tsx
      {/* The PNG's empty margin above his coin would waste the top of the window. */}
      <Animated.View style={[{ marginTop: -size * mascot.trimTop }, rising]}>
        <Image source={POSES[pose]} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
```

with

```tsx
      {/* The canvas's empty margin above his coin would waste the top of the window. */}
      <Animated.View style={[{ marginTop: -size * mascot.trimTop }, rising]}>
        <Mascot state={state} size={size} />
      </Animated.View>
```

In `MascotCelebrate`, replace

```tsx
      <Image source={success} style={{ width: size, height: size }} resizeMode="contain" />
```

with

```tsx
      <Mascot state="success" size={size} />
```

- [x] **Step 4: Update the two callers**

`apps/mobile/src/components/EmptyState.tsx`, in the `MascotPeek` element: `pose="idle"` → `state="idle"`.
`apps/mobile/src/features/goals/GoalCard.tsx`, in the `MascotPeek` element: `pose="success"` → `state="success"`.

- [x] **Step 5: Delete the PNGs and fix the token comment**

```bash
git rm assets/mascot/idle.png assets/mascot/success.png
```

In `packages/ui/src/tokens.ts`, the `trimTop` comment: replace `in both PNGs` wording so it reads

```ts
  /**
   * Transparent margin above the coin on his head, cut away. `success` catches him mid-hop, so its
   * coin sits highest (2.3% of the kit's canvas); `idle` keeps a sliver more above it.
   */
```

- [x] **Step 6: Run the tests**

Run: `npx jest src/components/Mascot.test.tsx src/components/EmptyState.test.tsx src/features/goals`
Expected: PASS. The existing `getByTestId('mascot')` assertions still find one element each: the inner `Mascot`
uses `mascot-<state>`.

- [x] **Step 7: Typecheck and commit**

```bash
cd ../.. && rtk proxy pnpm typecheck
git add -A apps/mobile/src/components apps/mobile/src/features/goals/GoalCard.tsx packages/ui/src/tokens.ts apps/mobile/assets/mascot
git commit -m "feat(mobile): Rocky plays the kit's Lottie states in the peek and the celebration"
```

---

### Task 4: Sizes for the new places

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `mascot` object)
- Test: `packages/ui/src/tokens.test.ts` (`describe('mascot')`)

- [x] **Step 1: Write the failing test**

In `packages/ui/src/tokens.test.ts`, inside `describe('mascot', …)`, add:

```ts
  it('stays small next to an error, smaller than wherever he is the subject', () => {
    expect(mascot.errorSize).toBeLessThan(mascot.loadingSize);
    expect(mascot.errorSize).toBeLessThan(mascot.welcomeSize);
    expect(mascot.errorSize).toBeLessThan(mascot.lockSize);
  });
```

- [x] **Step 2: Run it to see it fail**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: FAIL, `expected undefined to be less than undefined`.

- [x] **Step 3: Add the sizes**

In `packages/ui/src/tokens.ts`, in `mascot`, after `celebrateFromY: 14,` add:

```ts
  /** Waving above the welcome's title (§6.29 step 0). */
  welcomeSize: 120,
  /** Asleep in place of the lock screen's icon (§6.32). */
  lockSize: 136,
  /** Waiting in place of the spinner of a long, labelled load. */
  loadingSize: 104,
  /** Above a failed import's or restore's message: small, the words carry it. */
  errorSize: 64,
```

- [x] **Step 4: Run it to see it pass**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
git commit -m "feat(ui): mascot sizes for the welcome, the lock, a long wait and an error"
```

---

### Task 5: `ErrorNote`, in import and restore

**Files:**
- Create: `apps/mobile/src/components/ErrorNote.tsx`
- Test: `apps/mobile/src/components/ErrorNote.test.tsx`
- Modify: `apps/mobile/src/components/index.ts`
- Modify: `apps/mobile/app/profile/import.tsx` (the `error === null` block)
- Modify: `apps/mobile/app/profile/restore.tsx` (the `error === null` block)

- [x] **Step 1: Write the failing test**

`apps/mobile/src/components/ErrorNote.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ErrorNote } from './ErrorNote';

it('says what went wrong, with Rocky above it hidden from screen readers', async () => {
  await render(
    <ThemeProvider preference="dark">
      <ErrorNote message="This is not a Saldo backup." />
    </ThemeProvider>,
  );
  expect(screen.getByText('This is not a Saldo backup.')).toBeTruthy();
  expect(screen.getByTestId('mascot-error', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('mascot-error')).toBeNull();
});
```

- [x] **Step 2: Run it to see it fail**

Run: `cd apps/mobile && npx jest src/components/ErrorNote.test.tsx`
Expected: FAIL, `Cannot find module './ErrorNote'`.

- [x] **Step 3: Write the component**

`apps/mobile/src/components/ErrorNote.tsx`:

```tsx
import { mascot } from '@saldo/ui';
import { View } from 'react-native';
import { Text } from '../theme/Text';
import { Mascot } from './Mascot';

/**
 * A failed import or restore (§13 *Mascot*): Rocky, small and still after one play, above the
 * message. The message says what went wrong on its own; he only sets the tone.
 */
export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Mascot state="error" size={mascot.errorSize} />
      <Text size="footnote" color="accent" style={{ textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}
```

In `apps/mobile/src/components/index.ts`, after `export * from './EmptyState';` add:

```ts
export * from './ErrorNote';
```

- [x] **Step 4: Run it to see it pass**

Run: `npx jest src/components/ErrorNote.test.tsx`
Expected: PASS.

- [x] **Step 5: Use it in both screens**

In `apps/mobile/app/profile/import.tsx` and in `apps/mobile/app/profile/restore.tsx`, replace

```tsx
      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}
```

with

```tsx
      {error === null ? null : <ErrorNote message={error} />}
```

and add the import, in alphabetical position among the `../../src/components/…` imports:

```tsx
import { ErrorNote } from '../../src/components/ErrorNote';
```

Both files still use `Text` elsewhere; keep that import.

- [x] **Step 6: Gates and commit**

```bash
cd ../.. && rtk proxy pnpm typecheck && rtk proxy pnpm lint
git add apps/mobile/src/components/ErrorNote.tsx apps/mobile/src/components/ErrorNote.test.tsx apps/mobile/src/components/index.ts apps/mobile/app/profile/import.tsx apps/mobile/app/profile/restore.tsx
git commit -m "feat(mobile): Rocky above a failed import's or restore's message"
```

---

### Task 6: Rocky waits in a long load

**Files:**
- Modify: `apps/mobile/src/components/LoadingScreen.tsx`
- Test: `apps/mobile/src/components/LoadingScreen.test.tsx`

- [x] **Step 1: Write the failing test**

`apps/mobile/src/components/LoadingScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { LoadingScreen } from './LoadingScreen';

async function show(label?: string) {
  await render(
    <ThemeProvider preference="dark">
      <LoadingScreen label={label} />
    </ThemeProvider>,
  );
}

it('spins, wordless and without Rocky, through a short boot wait', async () => {
  await show();
  expect(screen.getByTestId('loading-spinner')).toBeTruthy();
  expect(screen.queryByTestId('mascot-loading', { includeHiddenElements: true })).toBeNull();
});

it('shows Rocky waiting, and says what for, through a long wait', async () => {
  await show('Downloading your data…');
  expect(screen.getByText('Downloading your data…')).toBeTruthy();
  expect(screen.getByTestId('mascot-loading', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('loading-spinner')).toBeNull();
});
```

- [x] **Step 2: Run it to see it fail**

Run: `cd apps/mobile && npx jest src/components/LoadingScreen.test.tsx`
Expected: FAIL, no element with testID `loading-spinner`.

- [x] **Step 3: Change the component**

Replace `apps/mobile/src/components/LoadingScreen.tsx` with:

```tsx
import { mascot } from '@saldo/ui';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { Mascot } from './Mascot';

/**
 * Full-screen wait on the theme background. Used for the boot gaps — migrations, the i18n
 * bundle, the first settings read — and those happen before i18n exists, so `label` is optional
 * and the screen is wordless without it.
 *
 * Pass one wherever the wait can be long enough to look like a hang: a spinner that never says
 * what it is waiting for is indistinguishable from a spinner that is stuck. A labelled wait is a
 * long one, so Rocky waits through it instead of the spinner (§13 *Mascot*); the short ones keep
 * the spinner, since he would arrive and leave in the same instant.
 */
export function LoadingScreen({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: theme.palette.bg,
      }}
    >
      {label === undefined ? (
        <ActivityIndicator testID="loading-spinner" color={theme.palette.textMuted} />
      ) : (
        <>
          <Mascot state="loading" size={mascot.loadingSize} />
          <Text size="footnote" color="textMuted">
            {label}
          </Text>
        </>
      )}
    </View>
  );
}
```

- [x] **Step 4: Run it to see it pass**

Run: `npx jest src/components/LoadingScreen.test.tsx`
Expected: PASS, 2 tests.

- [x] **Step 5: Commit**

```bash
git add src/components/LoadingScreen.tsx src/components/LoadingScreen.test.tsx
git commit -m "feat(mobile): Rocky waits through a long, labelled load"
```

---

### Task 7: Waving on the welcome, asleep on the lock screen

**Files:**
- Modify: `apps/mobile/app/(onboarding)/welcome.tsx`
- Modify: `apps/mobile/app/lock.tsx`

- [x] **Step 1: Welcome**

In `apps/mobile/app/(onboarding)/welcome.tsx`, add the imports:

```tsx
import { mascot } from '@saldo/ui';
import { Mascot } from '../../src/components/Mascot';
```

(`@saldo/ui` before `expo-router`; `Mascot` after `ListRow`, before `Screen`.) Then, right after `<Screen>`:

```tsx
      {/* §13 *Mascot*: he greets once, then holds the wave. */}
      <Mascot state="wave" size={mascot.welcomeSize} style={{ alignSelf: 'flex-start' }} />
```

- [x] **Step 2: Lock screen**

In `apps/mobile/app/lock.tsx`:
- add `import { mascot } from '@saldo/ui';` as the first import and
  `import { Mascot } from '../src/components/Mascot';` after the `Button` import;
- remove `import { Icon } from '../src/theme/Icon';` and `import { useTheme } from '../src/theme/ThemeProvider';`,
  and the line `const theme = useTheme();`;
- replace `<Icon name="shield" size={40} color={theme.palette.textMuted} />` with

```tsx
        {/* §6.32: asleep until the user unlocks; the title says the same. */}
        <Mascot state="sleep" size={mascot.lockSize} />
```

- [x] **Step 3: Gates and commit**

```bash
cd ../.. && rtk proxy pnpm typecheck && rtk proxy pnpm lint
git add "apps/mobile/app/(onboarding)/welcome.tsx" apps/mobile/app/lock.tsx
git commit -m "feat(mobile): Rocky waves on the welcome and sleeps on the lock screen"
```

---

### Task 8: Verification on device, and closing the item

**Files:**
- Modify: `ROADMAP.md` (tick the item), this plan (tick steps, record device decisions)
- Possibly modify: `packages/ui/src/tokens.ts`, `apps/mobile/src/components/mascotPlayback.ts`, spec §13

- [x] **Step 1: Gates, read from the output, not the exit code (AGENTS.md)**

```bash
rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm test
```
Expected: no `lint/…` lines and no `× Some errors were emitted`; typecheck clean; every suite passes.

- [x] **Step 2: New dev build** (a native module was added; Metro alone will not load it)

```bash
cd apps/mobile && npx expo run:ios
```

- [x] **Step 3: Check each place, light and dark, then with Reduce Motion on**

| Place | How to reach it | What to check |
|---|---|---|
| Welcome | fresh install, or «Esci» then a local-only start | waves once, holds the raised paw; alignment against the title |
| Lock | enable the lock in Profile, background 60 s | sleeps in a loop, `z` visible |
| Long wait | sign in to a server with data (first sync) | loops above the label |
| Error | Profile → Ripristina backup → pick a non-backup file | one play, stops with the sweat drop, message readable |
| Nothing yet | Budgets with none | rises, plays `idle` once, cut below the chin |
| Reached goal | a goal at 100% | rises, `success` once; not frozen-looking mid-hop |
| Close sheet | close that goal | arrives with the overshoot, `success` once |

With Reduce Motion on, every place shows the pose at once, loops included.

- [x] **Step 4: Record what the device changed**

Any size changed in `mascot`, any pose frame moved (e.g. `success` to its last frame), or the welcome alignment:
change it, update §13 *Mascot* in the spec and the «Decisions» list above in the same commit.

- [x] **Step 5: Close the roadmap item**

In `ROADMAP.md`, *Mascot states*, tick the Lottie bullet (`- [ ]` → `- [x]`) and append «checked on the iOS
simulator.» Tick this plan's steps.

```bash
git add ROADMAP.md docs/superpowers/plans/2026-09-25-mascot-lottie.md
git commit -m "docs(plan): mascot as Lottie states done, checked on the simulator"
```
