# Empty States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the improvised empty states with one `EmptyState` component that has three shapes. "Nothing yet" gets the 3D ghost stack chosen in design review (variant B), "nothing matches" gets a quiet fade, and "not found" does not move.

**Architecture:** `@saldo/ui` gets the stack geometry, the timing and four ghost colours as plain tokens. `apps/mobile/src/components/EmptyState.tsx` renders the three shapes from a discriminated union, so a "nothing yet" state cannot be built without a ghost and no state can be built without an action. `NotFoundScreen` wraps the not-found shape for the nine detail and edit screens. Each call site passes copy and an action and keeps nothing else.

**Tech Stack:** React Native 0.86, Reanimated 4.5 (`useSharedValue`, `useAnimatedStyle`, `withTiming`, `withDelay`, `interpolate`), expo-router with typed routes, i18next, Jest with `@testing-library/react-native`, and Vitest for `@saldo/ui` and `@saldo/i18n`.

---

## Decisions (the spec is silent except §6.3; recorded here per AGENTS.md)

- **Three shapes, not one.**
  - `yet`: nothing has been created. It is seen once or twice in the app's life, so this is where the motion budget goes: three ghost layers of the missing thing, tilted in perspective, fanning in with a 60ms stagger. The layers compress on CTA press-in and spring back on release.
  - `noMatch`: things exist but a filter or a period hides them. It is seen often, so it only fades in (`appearing`, 200ms) with no depth and no stagger.
  - `notFound`: the record was deleted or has not synced yet. It is an error, not a welcome, so it has no motion.
- **Every empty state carries an action.** `action` is required by the type, because Budgets already needed a separate fix for a missing one (`fix(mobile): keep a way into Budgets when there are none`).
- **Transactions tab keeps §6.3's two cases, with no extra query.** The tab is period-scoped, so "no rows without filters" can mean "nothing ever" or "nothing this period". It stays one generic `yet` state (decided in review: no hook, no extra request), so its copy has to be true in both cases. It says "record an expense", not "record your *first* expense". "Nessun risultato" + "Azzera filtri" and "Nessuna transazione" + "Nuova transazione" are kept exactly.
- **Depth without `preserve-3d`.** React Native has no `transform-style: preserve-3d`, so each ghost is a sibling view with its own `perspective`/`rotateX`/`rotateZ`. Nothing is nested in 3D, and it renders the same on Android.
- **Dark theme contrast.** On `bg #0A0A0A`, ghosts drawn with `surface`/`border` disappeared (flagged in review). Dark ghosts step up one level each: `raised`, `borderStrong`, `barGrey` and `segmentOther`. A token test pins this.
- **In-card empties stay inline.** The Home "recent" list, the account detail "recent" list, the Stats split card and `HomeBudgetCard` live inside a card next to other content, where a 112px stack would be wrong. They keep their muted line. The one exception is `TagFilterSheet`, which said "No transactions" when there are no tags; Task 9 corrects its key.
- **Accounts have no "nothing yet".** Onboarding always creates an account and no screen lists zero accounts. `accounts.empty` is used only by the two account not-found screens, which switch to `NotFoundScreen`.
- **Mascot later.** Variant D (the raccoon peeking over the ghost) was designed and deferred. `GhostStack` is the single element it would replace.

Design reference (local only, `docs/design/` is gitignored): `docs/design/empty-states.variants.html`, variant B.

## File map

| File | Change |
| --- | --- |
| `packages/ui/src/tokens.ts` | `Palette` + 4 ghost colours; new `emptyState` geometry/timing export |
| `packages/ui/src/tokens.test.ts` | ghost contrast + stack geometry tests |
| `packages/i18n/src/locales/en.ts`, `it.ts` | 7 new keys, `recurrence.empty` shortened |
| `apps/mobile/src/components/EmptyState.tsx` | **new** — `EmptyState`, `GhostStack` |
| `apps/mobile/src/components/EmptyState.test.tsx` | **new** |
| `apps/mobile/src/components/NotFoundScreen.tsx` | **new** |
| `apps/mobile/src/components/NotFoundScreen.test.tsx` | **new** |
| `apps/mobile/src/components/index.ts` | export both |
| `apps/mobile/app/(tabs)/transactions.tsx` | filtered / unfiltered empty |
| `apps/mobile/app/budgets.tsx` | card + dashed button → `EmptyState` |
| `apps/mobile/app/settings/categories.tsx`, `settings/tags.tsx`, `recurrences.tsx` | → `EmptyState` |
| 9 detail/edit screens (Task 8) | → `NotFoundScreen` |
| `apps/mobile/src/features/transactions/TagFilterSheet.tsx` | wrong key |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` | §13 note |
| `TODO.md` | close the item |

All commands run from the repo root. Gate commands go through `rtk proxy`, because AGENTS.md records two false greens from the filtered output.

---

### Task 1: Tokens — ghost colours and stack geometry

**Files:**
- Modify: `packages/ui/src/tokens.ts`
- Test: `packages/ui/src/tokens.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/ui/src/tokens.test.ts` (and add `emptyState` to the import on line 2: `import { categoryColorNames, categoryColors, emptyState, palettes, trackingPx, withAlpha } from './tokens';`):

```ts
describe('ghost colours', () => {
  it('stand further off the page than a plain surface does, in both themes', () => {
    // Review found the dark stack invisible when it was drawn with surface/border on #0A0A0A.
    for (const theme of ['dark', 'light'] as const) {
      const p = palettes[theme];
      expect(contrast(p.ghost, p.bg)).toBeGreaterThanOrEqual(contrast(p.surface, p.bg));
    }
    expect(palettes.dark.ghost).not.toBe(palettes.dark.surface);
  });

  it('keep the ink inside a ghost visible against the ghost itself', () => {
    for (const theme of ['dark', 'light'] as const) {
      const p = palettes[theme];
      expect(contrast(p.ghostInk, p.ghost)).toBeGreaterThan(1.5);
    }
  });
});

describe('emptyState', () => {
  it('stacks three layers, each further back, smaller and fainter than the one before', () => {
    const { layers, opacity } = emptyState;
    expect(layers).toHaveLength(3);
    for (let i = 1; i < layers.length; i++) {
      const front = layers[i - 1];
      const back = layers[i];
      if (front === undefined || back === undefined) throw new Error('layer missing');
      expect(back.translateY).toBeLessThan(front.translateY);
      expect(back.scale).toBeLessThan(front.scale);
      for (const theme of ['dark', 'light'] as const) {
        expect(opacity[theme][i] ?? 1).toBeLessThan(opacity[theme][i - 1] ?? 0);
      }
    }
  });

  it('keeps the back layers more opaque on dark, where the page swallows them', () => {
    expect(emptyState.opacity.dark[2]).toBeGreaterThan(emptyState.opacity.light[2]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: FAIL. `emptyState` is not exported and `p.ghost` is `undefined`. Vitest reports `contrast` receiving `undefined`, or a TypeError.

- [ ] **Step 3: Implement**

In `packages/ui/src/tokens.ts`, add four fields to `interface Palette`, directly after `barGrey: string;`:

```ts
  /** Ghost layers of an empty state: the shape of what is missing (§13, empty states). */
  ghost: string;
  ghostEdge: string;
  ghostInk: string;
  ghostInkSoft: string;
```

In `palettes.dark`, after `barGrey: '#3A3A3A',`:

```ts
    // One step up from surface/border: at those values the stack vanished into #0A0A0A.
    ghost: '#1A1A1A',
    ghostEdge: 'rgba(255,255,255,0.12)',
    ghostInk: '#3A3A3A',
    ghostInkSoft: '#2A2A2A',
```

In `palettes.light`, after `barGrey: '#C9C9C6',`:

```ts
    ghost: '#FAFAF9',
    ghostEdge: 'rgba(0,0,0,0.08)',
    ghostInk: '#C9C9C6',
    ghostInkSoft: '#EDEDEB',
```

After the `motion` export, add:

```ts
/**
 * The "nothing yet" stack: three ghosts of the missing row, tilted and fanned. Each ghost is a
 * sibling view with its own perspective — React Native has no `preserve-3d`, so nesting them
 * would flatten on Android. Layers run front (0) to back (2).
 */
export const emptyState = {
  stackWidth: 184,
  stackHeight: 112,
  ghostTop: 44,
  ghostHeight: 46,
  perspective: 520,
  /** degrees */
  tiltX: 46,
  tiltZ: -15,
  layers: [
    { translateY: 0, scale: 1, enterFromY: 10, pressY: 3 },
    { translateY: -20, scale: 0.93, enterFromY: 4, pressY: 8 },
    { translateY: -38, scale: 0.86, enterFromY: -2, pressY: 13 },
  ],
  /** Per theme: dark keeps the back layers stronger, since #0A0A0A swallows them. */
  opacity: {
    dark: [1, 0.72, 0.42],
    light: [1, 0.6, 0.32],
  },
  enterFromScale: 0.9,
  pressScale: 0.02,
  enterMs: 520,
  staggerMs: 60,
  paddingY: 56,
  paddingX: 24,
  bodyMaxWidth: 280,
} as const;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk proxy pnpm --filter @saldo/ui test`
Expected: PASS, including the existing `define the same tokens for dark and light` and `only contain valid colours`.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/ui/src/tokens.ts packages/ui/src/tokens.test.ts
rtk git commit -m "feat(ui): ghost colours and stack geometry for empty states"
```

---

### Task 2: Copy

**Files:**
- Modify: `packages/i18n/src/locales/en.ts`, `packages/i18n/src/locales/it.ts`
- Test: `packages/i18n/src/locales.test.ts` (existing parity test, no edit)

- [ ] **Step 1: Check who reads `recurrence.empty`**

Run: `rtk grep "recurrence.empty" apps packages`
Expected: exactly two hits, `apps/mobile/app/recurrences.tsx` and `apps/mobile/app/recurrence/[id].tsx`. Both are rewritten in Tasks 7 and 8, so shortening the string is safe.

- [ ] **Step 2: Add the keys to `en.ts`**

In `common`, after `thisOne: 'this one',` (keep whatever the current value is; only add the two lines):

```ts
    notFoundTitle: 'Not here any more',
    notFoundBody: 'It was deleted, or it has not reached this phone yet.',
```

In `transactions`, after `empty: 'No transactions',`:

```ts
    // True both on a fresh install and in an empty period of a used one: the tab is period-scoped.
    emptyBody: 'Record an expense: statistics, budgets and every account balance start there.',
    noResultsBody: 'No transaction matches the search and filters.',
```

In `budgets`, after `empty: 'No budgets',`:

```ts
    emptyBody: 'A budget caps a category and warns you when you are ahead of the month’s pace.',
```

In `tags`, after `empty: 'No tags',`:

```ts
    emptyBody: 'Tags cut across categories: “holiday”, “work”, “to reimburse”. Add one while recording a transaction.',
```

In `recurrence`, replace `empty: 'No recurrences. Turn on “Repeat” on a transaction to create one.',` with:

```ts
    empty: 'No recurrences',
    emptyBody: 'Turn on “Repeat” on a transaction: rent, subscriptions and salary then record themselves.',
```

- [ ] **Step 3: Add the same keys to `it.ts`**

`common`:

```ts
    notFoundTitle: 'Non c’è più',
    notFoundBody: 'È stato eliminato, oppure non è ancora arrivato su questo telefono.',
```

`transactions`, after `empty: 'Nessuna transazione',`:

```ts
    // Vero sia a installazione vuota sia in un periodo vuoto: la tab è legata al periodo.
    emptyBody: 'Registra una spesa: da lì nascono le statistiche, i budget e il saldo di ogni conto.',
    noResultsBody: 'Nessuna transazione corrisponde a ricerca e filtri attivi.',
```

`budgets`, after `empty: 'Nessun budget',`:

```ts
    emptyBody: 'Un budget fissa un tetto per categoria e ti avvisa quando sei in anticipo sul passo del mese.',
```

`tags`, after `empty: 'Nessun tag',`:

```ts
    emptyBody: 'I tag tagliano di traverso alle categorie: «vacanza», «lavoro», «da rimborsare». Aggiungine uno mentre registri una transazione.',
```

`recurrence`, replace the `empty:` line with:

```ts
    empty: 'Nessuna ricorrenza',
    emptyBody: 'Attiva «Ripeti» su una transazione: affitto, abbonamenti e stipendio si registrano da soli.',
```

- [ ] **Step 4: Run the parity test**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS (`have identical key structure in it and en`).

- [ ] **Step 5: Commit**

```bash
rtk git add packages/i18n/src/locales/en.ts packages/i18n/src/locales/it.ts
rtk git commit -m "feat(i18n): say why an empty screen is worth filling"
```

---

### Task 3: `EmptyState` component

**Files:**
- Create: `apps/mobile/src/components/EmptyState.tsx`
- Create: `apps/mobile/src/components/EmptyState.test.tsx`
- Modify: `apps/mobile/src/components/index.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/components/EmptyState.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { EmptyState, type EmptyStateProps } from './EmptyState';

const onPress = jest.fn();

beforeEach(() => onPress.mockClear());

const copy = {
  title: 'No budgets',
  body: 'A budget caps a category.',
  action: { label: 'New budget', onPress },
};

// RNTL 14: render is async.
async function renderState(props: EmptyStateProps, theme: 'dark' | 'light' = 'dark') {
  await render(
    <ThemeProvider preference={theme}>
      <EmptyState {...props} />
    </ThemeProvider>,
  );
}

describe('EmptyState', () => {
  it.each([
    { kind: 'yet', ghost: 'bar', ...copy },
    { kind: 'noMatch', icon: 'search', ...copy },
    { kind: 'notFound', icon: 'inbox', ...copy },
  ] as const)('$kind shows its title as a header, its body and its action', async (props) => {
    await renderState(props);
    expect(screen.getByRole('header', { name: 'No budgets' })).toBeTruthy();
    expect(screen.getByText('A budget caps a category.')).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'New budget' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws three ghost layers for "nothing yet", hidden from screen readers', async () => {
    await renderState({ kind: 'yet', ghost: 'row', ...copy });
    expect(screen.getAllByTestId('empty-ghost', { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.queryAllByTestId('empty-ghost')).toHaveLength(0);
  });

  it.each(['dark', 'light'] as const)('renders the stack in the %s theme', async (theme) => {
    await renderState({ kind: 'yet', ghost: 'chips', ...copy }, theme);
    expect(screen.getAllByTestId('empty-ghost', { includeHiddenElements: true })).toHaveLength(3);
  });

  it.each([
    { kind: 'noMatch', icon: 'search', ...copy },
    { kind: 'notFound', icon: 'inbox', ...copy },
  ] as const)('$kind draws no stack: nothing is waiting to be created', async (props) => {
    await renderState(props);
    expect(screen.queryAllByTestId('empty-ghost', { includeHiddenElements: true })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk proxy pnpm --filter mobile test -- src/components/EmptyState.test.tsx`
Expected: FAIL with `Cannot find module './EmptyState'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/components/EmptyState.tsx`:

```tsx
import { emptyState, type IconName } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { appearing, EASE, entering, useMotion } from '../theme/motion';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { SecondaryButton } from './Button';
import { IconBox } from './ListRow';

/** The shape of what is missing, drawn inside each ghost. */
export type GhostKind = 'row' | 'bar' | 'chips';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

interface Copy {
  title: string;
  body: string;
  /** Required: an empty state with no way forward is how Budgets became unreachable. */
  action: EmptyStateAction;
}

/**
 * Three different absences, three shapes:
 * - `yet` — nothing has been created. Rare, so it gets the ghost stack and a staggered entrance.
 * - `noMatch` — things exist; a filter or the period hides them. Frequent, so it only fades in.
 * - `notFound` — the record is gone. An error, so it does not move at all.
 */
export type EmptyStateProps =
  | (Copy & { kind: 'yet'; ghost: GhostKind })
  | (Copy & { kind: 'noMatch'; icon: IconName })
  | (Copy & { kind: 'notFound'; icon: IconName });

export function EmptyState(props: EmptyStateProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const yet = props.kind === 'yet';
  // The copy follows the stack in, one beat per line; the other shapes arrive as one block.
  const beat = (index: number) => (yet ? entering(index + 1) : undefined);

  return (
    <Animated.View
      entering={props.kind === 'noMatch' ? appearing : undefined}
      style={{
        alignItems: 'center',
        paddingVertical: emptyState.paddingY,
        paddingHorizontal: emptyState.paddingX,
      }}
    >
      {props.kind === 'yet' ? (
        <GhostStack kind={props.ghost} pressed={pressed} />
      ) : (
        <IconBox name={props.icon} colour={theme.palette.textMuted} />
      )}
      <Animated.View entering={beat(0)}>
        <Text
          size="headline"
          weight="medium"
          tracking="tight"
          accessibilityRole="header"
          style={{ marginTop: 16, textAlign: 'center' }}
        >
          {props.title}
        </Text>
      </Animated.View>
      <Animated.View entering={beat(1)}>
        <Text
          size="footnote"
          color="textMuted"
          style={{ marginTop: 6, textAlign: 'center', maxWidth: emptyState.bodyMaxWidth }}
        >
          {props.body}
        </Text>
      </Animated.View>
      <Animated.View entering={beat(2)} style={{ marginTop: 18 }}>
        <SecondaryButton
          label={props.action.label}
          onPress={props.action.onPress}
          // The stack is what the button creates, so pressing it pushes the stack down.
          onPressIn={
            yet
              ? () => pressed.set(withTiming(1, { duration: theme.motion.pressMs, easing: EASE }))
              : undefined
          }
          onPressOut={
            yet
              ? () => pressed.set(withTiming(0, { duration: theme.motion.snapBackMs, easing: EASE }))
              : undefined
          }
        />
      </Animated.View>
    </Animated.View>
  );
}

/** Back to front: React Native paints later siblings on top. */
const DEPTHS = [2, 1, 0] as const;

function GhostStack({ kind, pressed }: { kind: GhostKind; pressed: SharedValue<number> }) {
  return (
    <View
      // Decoration: the title says what is missing.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: emptyState.stackWidth, height: emptyState.stackHeight }}
    >
      {DEPTHS.map((depth) => (
        <GhostLayer key={depth} depth={depth} kind={kind} pressed={pressed} />
      ))}
    </View>
  );
}

function GhostLayer({
  depth,
  kind,
  pressed,
}: {
  depth: (typeof DEPTHS)[number];
  kind: GhostKind;
  pressed: SharedValue<number>;
}) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const layer = emptyState.layers[depth];
  const opacity = emptyState.opacity[theme.name][depth];
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(
      withDelay(
        depth * emptyState.staggerMs,
        withTiming(1, { duration: emptyState.enterMs, easing: EASE }),
      ),
    );
  }, [reduced, depth, progress]);

  const animated = useAnimatedStyle(() => {
    const p = progress.get();
    const q = pressed.get();
    return {
      opacity: p * opacity,
      transform: [
        { perspective: emptyState.perspective },
        { rotateX: `${emptyState.tiltX}deg` },
        { rotateZ: `${emptyState.tiltZ}deg` },
        { translateY: interpolate(p, [0, 1], [layer.enterFromY, layer.translateY]) + q * layer.pressY },
        {
          scale:
            interpolate(p, [0, 1], [emptyState.enterFromScale, layer.scale]) -
            q * emptyState.pressScale,
        },
      ],
    };
  });

  return (
    <Animated.View
      testID="empty-ghost"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: emptyState.ghostTop,
          height: emptyState.ghostHeight,
          borderRadius: theme.radii.input,
          borderWidth: 1,
          borderColor: theme.palette.ghostEdge,
          // The furthest ghost is dashed: the one that is not there yet.
          borderStyle: depth === 2 ? 'dashed' : 'solid',
          backgroundColor: theme.palette.ghost,
          paddingHorizontal: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          transformOrigin: 'bottom',
        },
        animated,
      ]}
    >
      <GhostInner kind={kind} />
    </Animated.View>
  );
}

const CHIP_WIDTHS = [46, 34, 58, 28] as const;

function GhostInner({ kind }: { kind: GhostKind }) {
  const theme = useTheme();
  const { ghostInk: ink, ghostInkSoft: soft, ghostEdge: edge } = theme.palette;
  const bar = (width: `${number}%` | number, colour: string, height = 6) => (
    <View style={{ width, height, borderRadius: height / 2, backgroundColor: colour }} />
  );
  const box = (
    <View style={{ width: 20, height: 20, borderRadius: theme.radii.iconBox, backgroundColor: soft }} />
  );

  if (kind === 'chips') {
    return (
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {CHIP_WIDTHS.map((width) => (
          <View
            key={width}
            style={{
              width,
              height: 14,
              borderRadius: theme.radii.pill,
              backgroundColor: soft,
              borderWidth: 1,
              borderColor: edge,
            }}
          />
        ))}
      </View>
    );
  }
  if (kind === 'bar') {
    return (
      <>
        {box}
        <View style={{ flex: 1, gap: 5 }}>
          {bar('56%', ink)}
          <View style={{ height: 4, borderRadius: 2, backgroundColor: soft, overflow: 'hidden' }}>
            {bar('52%', ink, 4)}
          </View>
        </View>
      </>
    );
  }
  return (
    <>
      {box}
      <View style={{ flex: 1, gap: 5 }}>
        {bar('64%', ink)}
        {bar('40%', soft)}
      </View>
      {bar(34, ink, 7)}
    </>
  );
}
```

Add to `apps/mobile/src/components/index.ts` (keep alphabetical order, after `ConfirmDialog`):

```ts
export * from './EmptyState';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `rtk proxy pnpm --filter mobile test -- src/components/EmptyState.test.tsx`
Expected: PASS, 8 tests.

If `getByRole('header', …)` finds nothing, check that `Text` forwards `accessibilityRole`. It spreads `...rest` onto `RnText`, so it should.

If `.get()`/`.set()` are reported missing on the shared value, the installed Reanimated predates them. Switch to `.value` as `Skeleton.tsx` does, and note the change in this plan.

- [ ] **Step 5: Typecheck**

Run: `rtk proxy pnpm --filter mobile typecheck`
Expected: no errors. Watch for `transformOrigin`, which is supported since RN 0.73; this repo runs 0.86.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/mobile/src/components/EmptyState.tsx apps/mobile/src/components/EmptyState.test.tsx apps/mobile/src/components/index.ts
rtk git commit -m "feat(mobile): EmptyState with a 3D ghost stack for nothing-yet"
```

---

### Task 4: `NotFoundScreen`

**Files:**
- Create: `apps/mobile/src/components/NotFoundScreen.tsx`
- Create: `apps/mobile/src/components/NotFoundScreen.test.tsx`
- Modify: `apps/mobile/src/components/index.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/components/NotFoundScreen.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NotFoundScreen } from './NotFoundScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));

// `Screen` wires pull-to-refresh to sync; this screen owes it nothing more than the wiring.
jest.mock('../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockCanGoBack = true;
});

async function renderScreen() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <NotFoundScreen />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('NotFoundScreen', () => {
  it('says the record is gone and goes back', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Not here any more' })).toBeTruthy();
    // The header back button and the action share a label; the action is the last one.
    const buttons = screen.getAllByRole('button', { name: 'Back' });
    const action = buttons[buttons.length - 1];
    if (action === undefined) throw new Error('no action');
    await userEvent.press(action);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('goes home when a deep link left nothing behind it', async () => {
    mockCanGoBack = false;
    await renderScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk proxy pnpm --filter mobile test -- src/components/NotFoundScreen.test.tsx`
Expected: FAIL with `Cannot find module './NotFoundScreen'`.

- [ ] **Step 3: Implement**

`apps/mobile/src/components/NotFoundScreen.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { BackButton } from './ScreenHeader';

/**
 * A detail or edit screen whose record is gone: deleted here, deleted on another device and
 * synced, or not synced yet. One screen for all of them, because the user can do the same
 * thing in every case — leave.
 */
export function NotFoundScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <Screen>
      <BackButton />
      <EmptyState
        kind="notFound"
        icon="inbox"
        title={t('common.notFoundTitle')}
        body={t('common.notFoundBody')}
        action={{
          label: t('common.back'),
          // A deep link can open this with nothing behind it; home is the only way out then.
          onPress: () => (router.canGoBack() ? router.back() : router.replace('/')),
        }}
      />
    </Screen>
  );
}
```

Add to `apps/mobile/src/components/index.ts`, after `LoadingScreen`:

```ts
export * from './NotFoundScreen';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `rtk proxy pnpm --filter mobile test -- src/components/NotFoundScreen.test.tsx`
Expected: PASS, 2 tests.

If `Screen` needs more providers than safe-area, copy the host from `src/components/Screen.test.tsx`, which already renders `Screen` in jest.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/mobile/src/components/NotFoundScreen.tsx apps/mobile/src/components/NotFoundScreen.test.tsx apps/mobile/src/components/index.ts
rtk git commit -m "feat(mobile): one not-found screen for gone records"
```

---

### Task 5: Transactions tab

**Files:**
- Modify: `apps/mobile/app/(tabs)/transactions.tsx` (the `groups.length === 0 && upcoming.length === 0` branch, currently around line 378)

- [ ] **Step 1: Replace the card**

Import `EmptyState` next to the other components:

```ts
import { EmptyState } from '../../src/components/EmptyState';
```

Replace the whole `groups.length === 0 && upcoming.length === 0 ? ( <Animated.View entering={appearing}> <Card> … </Card> </Animated.View> )` branch with:

```tsx
        ) : groups.length === 0 && upcoming.length === 0 ? (
          active ? (
            <EmptyState
              kind="noMatch"
              icon="search"
              title={t('transactions.noResults')}
              body={t('transactions.noResultsBody')}
              action={{
                label: t('transactions.resetFilters'),
                onPress: () => setFilters(EMPTY_FILTERS),
              }}
            />
          ) : (
            // One state for "nothing ever" and "nothing this period": telling them apart would
            // cost a query, and the copy is written to be true in both.
            <EmptyState
              kind="yet"
              ghost="row"
              title={t('transactions.empty')}
              body={t('transactions.emptyBody')}
              action={{
                label: t('transactions.newTransaction'),
                onPress: () => router.push('/transaction/new'),
              }}
            />
          )
        ) : (
```

- [ ] **Step 2: Drop now-unused imports**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no trailing `× Some errors were emitted`. If Biome flags `Card` or `SecondaryButton` as unused in `transactions.tsx`, delete those imports. `appearing` is still used by the upcoming row, so keep it.

- [ ] **Step 3: Typecheck and test**

Run: `rtk proxy pnpm --filter mobile typecheck && rtk proxy pnpm --filter mobile test`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
rtk git add "apps/mobile/app/(tabs)/transactions.tsx"
rtk git commit -m "feat(mobile): Transactions empty states through EmptyState"
```

---

### Task 6: Budgets

**Files:**
- Modify: `apps/mobile/app/budgets.tsx` (the `views.length === 0` branch, around line 73)

- [ ] **Step 1: Replace the card and the dashed button**

Import:

```ts
import { EmptyState } from '../src/components/EmptyState';
```

Replace the whole `views.length === 0 ? ( <> <Card>…</Card> <Pressable …dashed…> </Pressable> </> )` branch with:

```tsx
      {views.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="bar"
          title={t('budgets.empty')}
          body={t('budgets.emptyBody')}
          action={{ label: t('budgets.newBudget'), onPress: () => router.push('/budget/new') }}
        />
      ) : (
```

Then update the header comment above the "+" `Pressable`, which mentions "the dashed card below", so it reads:

```tsx
        {/* Where Categorie and Conti keep theirs. The empty state below carries its own
            "Nuovo budget", where it is the only thing to do on the screen. */}
```

- [ ] **Step 2: Lint, typecheck, test**

Run: `rtk proxy pnpm lint && rtk proxy pnpm --filter mobile typecheck && rtk proxy pnpm --filter mobile test`
Expected: clean. Remove `Card` from the imports only if Biome reports it unused; the list branch still uses it.

- [ ] **Step 3: Commit**

```bash
rtk git add apps/mobile/app/budgets.tsx
rtk git commit -m "feat(mobile): Budgets empty state shows what a budget looks like"
```

---

### Task 7: Categories, Tags, Recurrences

**Files:**
- Modify: `apps/mobile/app/settings/categories.tsx` (inside `section`, around line 151)
- Modify: `apps/mobile/app/settings/tags.tsx` (around line 31)
- Modify: `apps/mobile/app/recurrences.tsx` (around line 138)

- [ ] **Step 1: Categories**

Import `EmptyState` from `'../../src/components/EmptyState'`. Inside `section`, replace the `parents.length === 0 ? ( <Card> …empty… </Card> )` branch with:

```tsx
        {parents.length === 0 ? (
          <EmptyState
            kind="yet"
            ghost="chips"
            title={t('categories.empty')}
            body={t('categories.emptyNote')}
            action={{
              label: t('categories.newCategory'),
              onPress: () => router.push('/category/new'),
            }}
          />
        ) : (
```

`router` is already in scope: line 190 uses it for the header "+".

- [ ] **Step 2: Tags**

Import `EmptyState` from `'../../src/components/EmptyState'`. Replace the `tags.length === 0 ? ( <Card> … </Card> )` branch with:

```tsx
      {tags.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="chips"
          title={t('tags.empty')}
          body={t('tags.emptyBody')}
          // Tags have no screen of their own to be born on: they are typed into a transaction.
          action={{
            label: t('transactions.newTransaction'),
            onPress: () => router.push('/transaction/new'),
          }}
        />
      ) : (
```

- [ ] **Step 3: Recurrences**

Import `EmptyState` from `'../src/components/EmptyState'`. Add `const router = useRouter();` at the top of `RecurrencesScreen` if it is not already there (check the component body; `useRouter` is already imported). Replace the `views.length === 0 ? ( <Card> <Text …>{t('recurrence.empty')}</Text> </Card> )` branch with:

```tsx
      {views.length === 0 ? (
        <EmptyState
          kind="yet"
          ghost="row"
          title={t('recurrence.empty')}
          body={t('recurrence.emptyBody')}
          // "Ripeti" lives on the transaction form (§6.33), so that is where this leads.
          action={{
            label: t('transactions.newTransaction'),
            onPress: () => router.push('/transaction/new'),
          }}
        />
      ) : (
```

- [ ] **Step 4: Lint, typecheck, test**

Run: `rtk proxy pnpm lint && rtk proxy pnpm --filter mobile typecheck && rtk proxy pnpm --filter mobile test`
Expected: clean. Remove any import Biome reports unused.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/mobile/app/settings/categories.tsx apps/mobile/app/settings/tags.tsx apps/mobile/app/recurrences.tsx
rtk git commit -m "feat(mobile): categories, tags and recurrences get a way forward when empty"
```

---

### Task 8: Nine not-found screens

**Files (each has an early `return (<Screen> … <Text color="textMuted">{t('…')}</Text> </Screen>)`):**

| File | Guard | Wrong key it shows today |
| --- | --- | --- |
| `apps/mobile/app/transaction/[id].tsx` | `transaction === null` | `transactions.empty` |
| `apps/mobile/app/transaction/edit/[id].tsx` | `transaction === null \|\| values === null` | `transactions.empty` |
| `apps/mobile/app/recurrence/[id].tsx` | `recurrence === null` | `recurrence.empty` |
| `apps/mobile/app/account/[id].tsx` | `account === undefined` | `accounts.empty` |
| `apps/mobile/app/account/edit/[id].tsx` | `account === undefined \|\| values === null` | `accounts.empty` |
| `apps/mobile/app/category/[id].tsx` | `category === undefined` | `stats.empty` |
| `apps/mobile/app/category/edit/[id].tsx` | `category === null \|\| values === null` | `categories.empty` |
| `apps/mobile/app/tag/[id].tsx` | `tag === undefined` | `tags.empty` |
| `apps/mobile/app/budget/[id].tsx` | `budget === null \|\| values === null` | `budgets.empty` |

- [ ] **Step 1: Replace each early return**

In each file, keep the guard condition exactly as it is and replace only the returned JSX, for example:

```tsx
  if (transaction === null) {
    return <NotFoundScreen />;
  }
```

Add the import at the depth of each file. For the files one directory down (`transaction/[id].tsx`, `recurrence/[id].tsx`, `account/[id].tsx`, `category/[id].tsx`, `tag/[id].tsx`, `budget/[id].tsx`):

```ts
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
```

For the `edit/` files (`transaction/edit/[id].tsx`, `account/edit/[id].tsx`, `category/edit/[id].tsx`):

```ts
import { NotFoundScreen } from '../../../src/components/NotFoundScreen';
```

`NotFoundScreen` draws its own `BackButton`, so do not leave another one above it.

- [ ] **Step 2: Lint**

Run: `rtk proxy pnpm lint`
Expected: Biome may report `Screen`, `BackButton` or `Text` unused in some of these files. Delete exactly the imports it names and re-run until no `lint/…` lines remain.

- [ ] **Step 3: Confirm no wrong key is left**

Run: `rtk grep -n "t('stats.empty')\|t('accounts.empty')\|t('recurrence.empty')" apps/mobile/app`
Expected: only `stats.empty` in `apps/mobile/app/(tabs)/stats.tsx` (the in-card line, kept on purpose) and `recurrence.empty` in `apps/mobile/app/recurrences.tsx`.

- [ ] **Step 4: Typecheck and test**

Run: `rtk proxy pnpm --filter mobile typecheck && rtk proxy pnpm --filter mobile test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
rtk git add "apps/mobile/app/transaction/[id].tsx" "apps/mobile/app/transaction/edit/[id].tsx" "apps/mobile/app/recurrence/[id].tsx" "apps/mobile/app/account/[id].tsx" "apps/mobile/app/account/edit/[id].tsx" "apps/mobile/app/category/[id].tsx" "apps/mobile/app/category/edit/[id].tsx" "apps/mobile/app/tag/[id].tsx" "apps/mobile/app/budget/[id].tsx"
rtk git commit -m "fix(mobile): gone records say they are gone, not that a list is empty"
```

---

### Task 9: Tag filter sheet copy

**Files:**
- Modify: `apps/mobile/src/features/transactions/TagFilterSheet.tsx:32`

- [ ] **Step 1: Fix the key**

With no tags, the sheet said "No transactions". Change:

```tsx
        <Text color="textMuted">{t('transactions.empty')}</Text>
```

to:

```tsx
        <Text color="textMuted">{t('tags.empty')}</Text>
```

It stays an inline line: it sits inside a sheet whose title already says "Tags".

- [ ] **Step 2: Test and commit**

Run: `rtk proxy pnpm --filter mobile test`
Expected: PASS.

```bash
rtk git add apps/mobile/src/features/transactions/TagFilterSheet.tsx
rtk git commit -m "fix(mobile): the tag filter says there are no tags, not no transactions"
```

---

### Task 10: Spec and TODO

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` (§13, after the Motion bullet)
- Modify: `TODO.md` (section "New UI for the empty states")

- [ ] **Step 1: Spec §13**

After the `- **Motion:** …` bullet, add:

```markdown
- **Empty states** (`EmptyState`, tokens `emptyState` and `palette.ghost*`): three shapes. **Nothing yet** draws
  three ghost layers of the missing row/bar/chips, tilted in perspective and fanned in (520ms, 60ms stagger),
  compressed while its CTA is pressed. **Nothing matches** (a filter or a period) only fades in. **Not found**
  (`NotFoundScreen`, a record deleted or not yet synced) does not move. Every one carries an action. Ghosts are
  sibling views with their own perspective, because React Native has no `preserve-3d`. On dark they use
  `raised`/`borderStrong`, because `surface`/`border` vanish into `bg`. In-card empties (Home recent, account recent,
  Stats split, the Home budget card) stay a muted line.
```

- [ ] **Step 2: TODO**

In `TODO.md`, replace the body of `## New UI for the empty states` with a closed entry:

```markdown
## New UI for the empty states — done 2026-09-21

`EmptyState` (`apps/mobile/src/components/EmptyState.tsx`) with three shapes — nothing yet, nothing matches,
not found — and `NotFoundScreen` for the nine detail and edit screens. The 3D ghost stack is variant B of the
design review; variant D (the raccoon peeking over the ghost) was designed and deferred until the mascot work
below, and `GhostStack` is the one element it would replace. Recorded in spec §13; plan
`docs/superpowers/plans/2026-09-21-empty-states.md`.
```

- [ ] **Step 3: Commit**

```bash
rtk git add docs/superpowers/specs/2026-09-10-saldo-poc-spec.md TODO.md
rtk git commit -m "docs: record the three empty-state shapes"
```

---

### Task 11: Verification

- [ ] **Step 1: Gates, read the output rather than the exit code**

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: lint shows no `lint/…` lines and no `× Some errors were emitted while running checks.`; typecheck is clean in every package; all test suites pass.

- [ ] **Step 2: On the simulator**

Start Metro with `pnpm --filter mobile start --clear`. Use a fresh install, or wipe data from Profile, then walk these:

1. Transactions tab, no data: ghost rows fan in and the copy follows. Press and hold "Nuova transazione": the stack sinks, and it springs back on release. The same state shows in an empty earlier period, and its copy must still read true there.
2. Search for nonsense: "Nessun risultato"; "Azzera i filtri" clears it.
3. Budgets with none: bar ghosts. Categories with a section empty: chip ghosts. Tags with none: chip ghosts. Recurrences with none: row ghosts.
4. Open a transaction, delete it on the web app, and sync: "Non c’è più" with no motion. "Indietro" leaves.
5. Repeat 1 and 3 in the light theme and in the dark theme: all three layers are visible in both.
6. Turn on iOS Settings → Accessibility → Reduce Motion: the stack appears already in place and nothing moves.

- [ ] **Step 3: Review**

Use **requesting-code-review** on `feat/empty-states` against `main`.
