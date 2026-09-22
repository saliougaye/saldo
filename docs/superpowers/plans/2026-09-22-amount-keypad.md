# Amount keypad ("Tastierino") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the device keyboard with Saldo's own keypad for **every** amount field, and give a negative-capable
field a tappable sign in front of the digits so its state is readable and changeable while the keypad is closed.

**Architecture:** `@saldo/core` gains one pure reducer, `pressAmountKey(buffer, key, minorDigits, options)`, so every
key press is a tested pure function. `Screen` hosts an `AmountKeypadProvider` and renders the pad in the same
absolutely-positioned bottom stack as the footer, so the footer rides above the pad. `AmountInput` keeps a real
`TextInput` — with `showSoftInputOnFocus={false}`, which RN 0.86 supports on both platforms — so VoiceOver keeps text
semantics, the caret still blinks and a hardware keyboard still types; focusing it opens the pad instead of the system
keyboard. A negative-capable field renders a sign tile (faint `+` / full `−`) before the digits: that tile is the one
`switch` exposed to assistive technology, and the keypad's `−` key is hidden from it to avoid two identical switches.

**Tech Stack:** TypeScript strict, React Native 0.86 / Expo 57, Reanimated (`react-native-reanimated`), jest-expo +
RNTL for the app, Vitest for packages, i18next.

**Decisions taken here (flagged for the user):**

1. **D23 is rewritten**, not annotated: the spec now says amounts are typed on Saldo's own keypad. §5.1, §6.16, §6.22
   and the testing table are updated with it.
2. **The field stays a `TextInput`** with the soft keyboard suppressed, rather than becoming a `Pressable`. Same visual
   result, but the accessibility tree, the caret, text selection and most existing tests survive.
3. **Onboarding steps:** the pad's tall key is «Continua» and the pad never closes (per the chosen mockup). To avoid
   two «Continua» buttons, `StepFooter` hides its primary button while the pad is open **and keeps «Indietro»**, so the
   way back is never lost. (The mockup hid the whole footer; losing Back on two onboarding steps is a regression, hence
   this arrangement. Easy to change if the user prefers the mockup exactly.)
4. **No haptics.** The app uses none today (no `expo-haptics` dependency anywhere), so adding one for key presses would
   be the only haptic in the product. Left out deliberately; one line in `AmountKeypad` adds it later.

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/amountKeypad.ts` | `AmountKeypadKey`, `pressAmountKey` — the only place key semantics live |
| `packages/core/src/amountKeypad.test.ts` | Its unit tests |
| `packages/ui/src/tokens.ts` | Keypad geometry tokens (`keypadGap`, `keypadPaddingX/Y`, `signTileWidth/Height`) |
| `packages/i18n/src/locales/{it,en}.ts` | `common.amountKeypad`, `common.deleteDigit`, `common.decimalPoint` |
| `apps/mobile/src/components/keypad/AmountKeypadProvider.tsx` | Context: which field the pad serves, open/close, reveal |
| `apps/mobile/src/components/keypad/AmountKeypad.tsx` | The pad itself: keys, action key, slide-in |
| `apps/mobile/src/components/keypad/revealOffset.ts` | Pure scroll maths for "keep the focused field visible" |
| `apps/mobile/src/components/keypad/revealOffset.test.ts` | Its unit tests |
| `apps/mobile/src/components/keypad/AmountKeypad.test.tsx` | Pad + provider behaviour through a real `Screen` |
| `apps/mobile/src/components/AmountInput.tsx` | Display + sign tile + opening the pad |
| `apps/mobile/src/components/AmountInput.test.tsx` | Field behaviour (sign, display, pinning) |
| `apps/mobile/src/components/Screen.tsx` | Hosts the provider, the pad and the bottom stack |
| `apps/mobile/src/features/onboarding/StepFooter.tsx` | Hides its primary button while the pad is open |
| `apps/mobile/app/(onboarding)/{balance,import-balances}.tsx` | Pinned pad + «Continua» action |
| `apps/mobile/src/components/a11y.test.tsx` | Updated AmountInput expectations, keypad key targets |
| `apps/mobile/maestro/*.yaml` | Tap keys instead of `inputText` |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md` | D23, §5.1, §6.16, §6.22, testing row |
| `TODO.md` | Item removed |

---

## Task 1: `pressAmountKey` in `@saldo/core`

**Files:**
- Create: `packages/core/src/amountKeypad.ts`
- Test: `packages/core/src/amountKeypad.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { pressAmountKey } from './amountKeypad';

describe('pressAmountKey', () => {
  it('appends digits', () => {
    expect(pressAmountKey('', '1', 2)).toBe('1');
    expect(pressAmountKey('1', '2', 2)).toBe('12');
  });

  it('replaces a lone zero rather than growing it', () => {
    expect(pressAmountKey('0', '5', 2)).toBe('5');
    expect(pressAmountKey('0.', '5', 2)).toBe('0.5');
  });

  it('stops at the currency scale: 6 + 2 for EUR, 8 + 0 for JPY', () => {
    expect(pressAmountKey('123456', '7', 2)).toBe('123456');
    expect(pressAmountKey('12345678', '9', 0)).toBe('12345678');
    expect(pressAmountKey('1.23', '4', 2)).toBe('1.23');
    expect(pressAmountKey('1.2', '3', 2)).toBe('1.23');
  });

  it('adds one separator only, and none at all for a 0-decimal currency', () => {
    expect(pressAmountKey('12', 'separator', 2)).toBe('12.');
    expect(pressAmountKey('12.3', 'separator', 2)).toBe('12.3');
    expect(pressAmountKey('', 'separator', 2)).toBe('0.');
    expect(pressAmountKey('12', 'separator', 0)).toBe('12');
  });

  it('deletes the last character, separator included', () => {
    expect(pressAmountKey('12.5', 'delete', 2)).toBe('12.');
    expect(pressAmountKey('12.', 'delete', 2)).toBe('12');
    expect(pressAmountKey('1', 'delete', 2)).toBe('');
    expect(pressAmountKey('', 'delete', 2)).toBe('');
  });

  it('keeps the sign while digits change, and drops it with the last digit', () => {
    expect(pressAmountKey('-1', '2', 2, { allowNegative: true })).toBe('-12');
    expect(pressAmountKey('-1', 'delete', 2, { allowNegative: true })).toBe('');
    expect(pressAmountKey('-', 'delete', 2, { allowNegative: true })).toBe('');
  });

  it('toggles the sign only where a balance may be negative', () => {
    expect(pressAmountKey('12', 'sign', 2, { allowNegative: true })).toBe('-12');
    expect(pressAmountKey('-12', 'sign', 2, { allowNegative: true })).toBe('12');
    expect(pressAmountKey('', 'sign', 2, { allowNegative: true })).toBe('-');
    expect(pressAmountKey('12', 'sign', 2)).toBe('12');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- --run amountKeypad`
Expected: FAIL, "Failed to resolve import ./amountKeypad".

- [ ] **Step 3: Implement**

```ts
import { maxIntegerDigits, type MinorDigits, toggleAmountBufferSign } from './money';

/** What a keypad can send. Digits are their own characters; the rest are named. */
export type AmountKeypadKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'separator'
  | 'delete'
  | 'sign';

export interface AmountKeypadOptions {
  /** Only a balance may go below zero (§5.1); elsewhere the sign key is not drawn and does nothing. */
  allowNegative?: boolean;
}

/**
 * One key press against an amount buffer (§5.1). Pure: the same rules as `sanitizeAmountInput`, but
 * expressed as edits rather than as a re-parse, because a keypad knows exactly what changed.
 */
export function pressAmountKey(
  buffer: string,
  key: AmountKeypadKey,
  minorDigits: MinorDigits,
  options: AmountKeypadOptions = {},
): string {
  if (key === 'sign') return options.allowNegative === true ? toggleAmountBufferSign(buffer) : buffer;

  const negative = buffer.startsWith('-');
  const body = negative ? buffer.slice(1) : buffer;
  const next = editBody(body, key, minorDigits);
  // A sign with no digits left is not a number: deleting the last digit clears the field entirely.
  if (next.length === 0) return '';
  return negative ? `-${next}` : next;
}

function editBody(body: string, key: Exclude<AmountKeypadKey, 'sign'>, minorDigits: MinorDigits): string {
  if (key === 'delete') return body.slice(0, -1);
  if (key === 'separator') {
    if (minorDigits === 0 || body.includes('.')) return body;
    return body.length === 0 ? '0.' : `${body}.`;
  }
  const [integer = '', fraction] = body.split('.');
  if (fraction === undefined) {
    if (integer === '0') return key;
    return integer.length >= maxIntegerDigits(minorDigits) ? body : `${integer}${key}`;
  }
  return fraction.length >= minorDigits ? body : `${integer}.${fraction}${key}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `rtk proxy pnpm --filter @saldo/core test -- --run amountKeypad`
Expected: PASS, 7 tests.

- [ ] **Step 5: Export it**

In `packages/core/src/index.ts`, beside `export * from './money';`:

```ts
export * from './amountKeypad';
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/amountKeypad.ts packages/core/src/amountKeypad.test.ts packages/core/src/index.ts
git commit -m "feat(core): one pure reducer for every amount keypad press"
```

---

## Task 2: Keypad geometry tokens

**Files:**
- Modify: `packages/ui/src/tokens.ts` (the `layout` object)

- [ ] **Step 1: Add the tokens**

In `layout`, after `keypadSaveWidth: 80,`:

```ts
  /** The keypad of §5.1: 3 digit columns plus the action column, 6pt apart. */
  keypadGap: 6,
  keypadPaddingX: 12,
  keypadPaddingY: 8,
  /** The sign in front of the digits: a 38pt line needs a 30×40 tile to sit on. */
  signTileWidth: 30,
  signTileHeight: 40,
```

- [ ] **Step 2: Run the token tests**

Run: `rtk proxy pnpm --filter @saldo/ui test -- --run`
Expected: PASS (the suite checks colours and ranges, not this list).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/tokens.ts
git commit -m "feat(ui): keypad and sign-tile geometry tokens"
```

---

## Task 3: The three new strings

**Files:**
- Modify: `packages/i18n/src/locales/it.ts`, `packages/i18n/src/locales/en.ts`

- [ ] **Step 1: Add them to `it.ts`, in `common`, after `negative: 'Negativo',`**

```ts
    amountKeypad: 'Tastierino',
    deleteDigit: 'Cancella',
    decimalPoint: 'Virgola',
```

- [ ] **Step 2: Add the same keys to `en.ts`, in `common`, after `negative: 'Negative',`**

```ts
    amountKeypad: 'Keypad',
    deleteDigit: 'Delete',
    decimalPoint: 'Decimal point',
```

- [ ] **Step 3: Run the parity test**

Run: `rtk proxy pnpm --filter @saldo/i18n test -- --run`
Expected: PASS — `locales.test.ts` compares the key sets.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/src/locales/it.ts packages/i18n/src/locales/en.ts
git commit -m "feat(i18n): names for the keypad, its delete and its separator key"
```

---

## Task 4: `revealOffset`, the pure scroll maths

**Files:**
- Create: `apps/mobile/src/components/keypad/revealOffset.ts`
- Test: `apps/mobile/src/components/keypad/revealOffset.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { revealOffset } from './revealOffset';

describe('revealOffset', () => {
  const viewport = { top: 100, bottom: 500 };

  it('scrolls nothing when the field already fits', () => {
    expect(revealOffset({ fieldTop: 200, fieldBottom: 300, ...viewport })).toBe(0);
  });

  it('scrolls down by what the keypad covers, plus a margin', () => {
    expect(revealOffset({ fieldTop: 420, fieldBottom: 540, ...viewport })).toBe(56);
  });

  it('scrolls up when the field is above the viewport', () => {
    expect(revealOffset({ fieldTop: 60, fieldBottom: 140, ...viewport })).toBe(-56);
  });

  it('prefers showing the top of a field taller than the viewport', () => {
    expect(revealOffset({ fieldTop: 90, fieldBottom: 900, ...viewport })).toBe(-26);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- revealOffset`
Expected: FAIL, "Cannot find module './revealOffset'".

- [ ] **Step 3: Implement**

```ts
/** Breathing room between the field and the edge of what the keypad leaves visible. */
export const REVEAL_MARGIN = 16;

export interface RevealBox {
  /** Window coordinates of the field. */
  fieldTop: number;
  fieldBottom: number;
  /** Window coordinates of what stays visible above the footer and the keypad. */
  top: number;
  bottom: number;
}

/**
 * How far to scroll so a field the keypad would cover comes back into view. Positive scrolls the
 * content up (the list moves towards its end), negative back towards the start, 0 leaves it alone.
 */
export function revealOffset({ fieldTop, fieldBottom, top, bottom }: RevealBox): number {
  if (fieldTop - REVEAL_MARGIN < top) return fieldTop - REVEAL_MARGIN - top;
  if (fieldBottom + REVEAL_MARGIN > bottom) return fieldBottom + REVEAL_MARGIN - bottom;
  return 0;
}
```

- [ ] **Step 4: Run the tests**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- revealOffset`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/keypad/revealOffset.ts apps/mobile/src/components/keypad/revealOffset.test.ts
git commit -m "feat(mobile): scroll maths that keeps a field out from under the keypad"
```

---

## Task 5: The keypad context

**Files:**
- Create: `apps/mobile/src/components/keypad/AmountKeypadProvider.tsx`

A field registers a *session* when it is focused; the provider keeps the active one and hands it to the pad. Callbacks
arrive through a ref inside `AmountInput`, so a session object stays stable across the caller's re-renders.

- [ ] **Step 1: Write the provider (no test of its own: Task 7 drives it through the real components)**

```tsx
import { type AmountKeypadKey } from '@saldo/core';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

export interface AmountKeypadSession {
  /** Identity of the field, so a second field can take the pad over from the first. */
  id: string;
  allowNegative: boolean;
  /** No separator key at all for a currency without a minor unit (§5.1). */
  separator: string | null;
  /** What the sign key would announce if it were not hidden — kept for parity with the field. */
  negativeLabel?: string;
  /** Label of the tall key: «Fatto» normally, «Continua» on an onboarding step. */
  actionLabel: string;
  /** A pinned pad stays up when the field loses focus (the onboarding steps). */
  pinned: boolean;
  onKey: (key: AmountKeypadKey) => void;
  onAction: () => void;
  /** Whether the amount is negative right now, so the sign key can show it. */
  isNegative: () => boolean;
  /** The field's own view, so the screen can scroll it clear of the pad. */
  node: React.RefObject<View | null>;
}

export interface AmountKeypadController {
  session: AmountKeypadSession | null;
  open: (session: AmountKeypadSession) => void;
  /** Closes only if the caller still owns the pad, so a field losing focus to the next one is a no-op. */
  close: (id: string) => void;
  /** Version counter: bumped on every press, so the pad re-reads `isNegative()`. */
  version: number;
  bump: () => void;
}

const noop = () => undefined;
const AmountKeypadContext = createContext<AmountKeypadController>({
  session: null,
  open: noop,
  close: noop,
  version: 0,
  bump: noop,
});

export function useAmountKeypad(): AmountKeypadController {
  return useContext(AmountKeypadContext);
}

export function AmountKeypadProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AmountKeypadSession | null>(null);
  const [version, setVersion] = useState(0);
  const current = useRef<string | null>(null);

  const open = useCallback((next: AmountKeypadSession) => {
    current.current = next.id;
    setSession(next);
  }, []);

  const close = useCallback((id: string) => {
    if (current.current !== id) return;
    current.current = null;
    setSession(null);
  }, []);

  const bump = useCallback(() => setVersion((n) => n + 1), []);

  const value = useMemo(
    () => ({ session, open, close, version, bump }),
    [session, open, close, version, bump],
  );
  return <AmountKeypadContext.Provider value={value}>{children}</AmountKeypadContext.Provider>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/keypad/AmountKeypadProvider.tsx
git commit -m "feat(mobile): the context that hands the keypad to the focused amount field"
```

---

## Task 6: The keypad itself

**Files:**
- Create: `apps/mobile/src/components/keypad/AmountKeypad.tsx`

Layout: three digit columns on the left, an 80pt column on the right holding `⌫` above a tall action key. Bottom row is
`sign · 0 · separator`, so `0` and the separator never move between screens; a field that cannot go negative leaves the
bottom-left cell empty rather than reshuffling the keys. The `−` key is hidden from assistive technology: the field's
own sign tile is the one switch (Task 7).

- [ ] **Step 1: Write the component**

```tsx
import { type AmountKeypadKey } from '@saldo/core';
import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Icon } from '../../theme/Icon';
import { EASE, useMotion } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { AmountKeypadSession } from './AmountKeypadProvider';

const ROWS: readonly (readonly AmountKeypadKey[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['sign', '0', 'separator'],
];

export interface AmountKeypadProps {
  session: AmountKeypadSession;
  /** Re-read on every press, so the sign key shows the state it toggles. */
  negative: boolean;
  onLayoutHeight: (height: number) => void;
}

/**
 * Saldo's own keypad (§5.1): the amount fields never open the device keyboard, so the keys are the
 * same on iOS and Android, the separator follows the app's language rather than the device's, and a
 * balance gets a `−` key where a calculator has one.
 */
export function AmountKeypad({ session, negative, onLayoutHeight }: AmountKeypadProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { duration } = useMotion();
  const offset = useSharedValue(1);

  useEffect(() => {
    offset.value = withTiming(0, { duration: duration(motion.sheetMs), easing: EASE });
  }, [offset, duration]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value * 320 }] }));

  const key = (name: AmountKeypadKey) => {
    if (name === 'sign' && !session.allowNegative) {
      return <View key="sign" style={{ flex: 1 }} />;
    }
    if (name === 'separator' && session.separator === null) {
      return <View key="separator" style={{ flex: 1 }} />;
    }
    const sign = name === 'sign';
    const label = name === 'separator' ? (session.separator ?? '') : sign ? '−' : name;
    return (
      <Pressable
        key={name}
        testID={`keypad-key-${name}`}
        accessibilityRole={sign ? undefined : 'button'}
        accessibilityLabel={name === 'separator' ? t('common.decimalPoint') : label}
        // The field's sign tile is the switch VoiceOver drives; two switches with one name is worse
        // than one, and the tile is always on screen while this key is not.
        accessibilityElementsHidden={sign}
        importantForAccessibility={sign ? 'no-hide-descendants' : 'yes'}
        onPress={() => session.onKey(name)}
        style={({ pressed }) => ({
          flex: 1,
          height: theme.layout.keypadKeyHeight,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.input,
          borderWidth: 1,
          borderColor: theme.palette.border,
          backgroundColor: sign && negative ? theme.palette.accent : theme.palette.raised,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <Text
          size="amountKey"
          weight="medium"
          tabular
          color={sign && negative ? 'onAccent' : 'text'}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <Animated.View
      testID="amount-keypad"
      accessibilityLabel={t('common.amountKeypad')}
      onLayout={(event) => onLayoutHeight(event.nativeEvent.layout.height)}
      style={[
        {
          flexDirection: 'row',
          gap: theme.layout.keypadGap,
          paddingHorizontal: theme.layout.keypadPaddingX,
          paddingTop: theme.layout.keypadPaddingY,
          backgroundColor: theme.palette.bg,
          borderTopWidth: 1,
          borderTopColor: theme.palette.border,
        },
        slide,
      ]}
    >
      <View style={{ flex: 1, gap: theme.layout.keypadGap }}>
        {ROWS.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: theme.layout.keypadGap }}>
            {row.map(key)}
          </View>
        ))}
      </View>
      <View style={{ width: theme.layout.keypadSaveWidth, gap: theme.layout.keypadGap }}>
        <Pressable
          testID="keypad-key-delete"
          accessibilityRole="button"
          accessibilityLabel={t('common.deleteDigit')}
          onPress={() => session.onKey('delete')}
          style={({ pressed }) => ({
            height: theme.layout.keypadKeyHeight,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.input,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Icon name="del" size={22} color={theme.palette.textMuted} />
        </Pressable>
        <Pressable
          testID="keypad-action"
          accessibilityRole="button"
          accessibilityLabel={session.actionLabel}
          onPress={session.onAction}
          style={({ pressed }) => ({
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.button,
            backgroundColor: theme.palette.accent,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text size="headline" weight="medium" tracking="tight" color="onAccent">
            {session.actionLabel}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/keypad/AmountKeypad.tsx
git commit -m "feat(mobile): Saldo's own amount keypad"
```

---

## Task 7: `Screen` hosts the pad

**Files:**
- Modify: `apps/mobile/src/components/Screen.tsx`
- Test: `apps/mobile/src/components/keypad/AmountKeypad.test.tsx`

The footer and the pad share one absolutely-positioned stack, so the footer sits on top of the pad and both leave the
screen together. Content reserves `footerHeight + padHeight`. The `KeyboardAvoidingView` stays: a screen can still hold
a text field (name, description) that opens the real keyboard.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { AmountInput } from '../AmountInput';
import { Screen } from '../Screen';

jest.mock('../../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

function Field(props: { buffer?: string; onChange?: (next: string) => void; allowNegative?: boolean }) {
  return (
    <Host>
      <Screen>
        <AmountInput
          testID="amount"
          buffer={props.buffer ?? ''}
          onChange={props.onChange ?? jest.fn()}
          currency="EUR"
          locale="it"
          label="Importo"
          doneLabel="Fatto"
          allowNegative={props.allowNegative}
          negativeLabel="Negativo"
        />
      </Screen>
    </Host>
  );
}

describe('AmountKeypad', () => {
  it('stays away until a field asks for it', async () => {
    await render(<Field />);
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
  });

  it('comes up when the field is focused, and types into it', async () => {
    const onChange = jest.fn();
    await render(<Field onChange={onChange} />);
    await userEvent.press(screen.getByTestId('amount'));
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
    await userEvent.press(screen.getByTestId('keypad-key-7'));
    expect(onChange).toHaveBeenCalledWith('7');
  });

  it('writes the app separator into the buffer whatever the language shows', async () => {
    const onChange = jest.fn();
    await render(<Field buffer="12" onChange={onChange} />);
    await userEvent.press(screen.getByTestId('amount'));
    expect(screen.getByTestId('keypad-key-separator')).toHaveTextContent(',');
    await userEvent.press(screen.getByTestId('keypad-key-separator'));
    expect(onChange).toHaveBeenCalledWith('12.');
  });

  it('deletes with the key above the action', async () => {
    const onChange = jest.fn();
    await render(<Field buffer="12" onChange={onChange} />);
    await userEvent.press(screen.getByTestId('amount'));
    await userEvent.press(screen.getByTestId('keypad-key-delete'));
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('offers no sign key unless the amount may be negative', async () => {
    await render(<Field />);
    await userEvent.press(screen.getByTestId('amount'));
    expect(screen.queryByTestId('keypad-key-sign')).toBeNull();
  });

  it('flips the sign from the keypad', async () => {
    const onChange = jest.fn();
    await render(<Field buffer="12" onChange={onChange} allowNegative />);
    await userEvent.press(screen.getByTestId('amount'));
    await userEvent.press(screen.getByTestId('keypad-key-sign'));
    expect(onChange).toHaveBeenCalledWith('-12');
  });

  it('goes away on the action key', async () => {
    await render(<Field />);
    await userEvent.press(screen.getByTestId('amount'));
    await userEvent.press(screen.getByTestId('keypad-action'));
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- AmountKeypad`
Expected: FAIL — no `amount-keypad` testID yet.

- [ ] **Step 3: Host the provider and the pad in `Screen`**

In `apps/mobile/src/components/Screen.tsx`, add to the imports:

```tsx
import { AmountKeypad } from './keypad/AmountKeypad';
import { AmountKeypadProvider, useAmountKeypad } from './keypad/AmountKeypadProvider';
import { revealOffset } from './keypad/revealOffset';
```

Rename the existing component to `ScreenBody` and export a wrapper that provides the context:

```tsx
export function Screen(props: ScreenProps) {
  return (
    <AmountKeypadProvider>
      <ScreenBody {...props} />
    </AmountKeypadProvider>
  );
}
```

Inside `ScreenBody`, after the existing `const [footerHeight, setFooterHeight] = useState(0);`:

```tsx
  const { session, version } = useAmountKeypad();
  const [padHeight, setPadHeight] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewport = useRef({ top: 0, bottom: 0 });
  const padded = session === null ? 0 : padHeight;

  // Bring the focused field out from under the pad. `measureInWindow` is a no-op under RNTL, so
  // this does nothing in tests and everything on a device.
  useEffect(() => {
    const node = session?.node.current;
    if (node === undefined || node === null || padHeight === 0) return;
    node.measureInWindow((_x, y, _width, height) => {
      const offset = revealOffset({
        fieldTop: y,
        fieldBottom: y + height,
        top: viewport.current.top,
        bottom: viewport.current.bottom,
      });
      if (offset !== 0) scroll.current?.scrollTo({ y: scrollY.current + offset, animated: true });
    });
  }, [session, padHeight]);
```

Give the scroll view the ref and the two measurements (add to the existing `<Scroller …>` props):

```tsx
            ref={scroll}
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              viewport.current = { top: y, bottom: y + height - footerHeight - padded };
            }}
```

Change the content padding to reserve the pad:

```tsx
              paddingBottom: 24 + tabBarSpace + footerHeight + padded,
```

and the same in the non-scrolling branch:

```tsx
              paddingBottom: tabBarSpace + footerHeight + padded,
```

Finally, put the pad below the footer inside the same absolute stack. Replace the footer block with:

```tsx
        {footer === undefined && session === null ? null : (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            {footer === undefined ? null : (
              <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
                <ScrollFade />
                <View
                  style={{
                    backgroundColor: theme.palette.bg,
                    paddingHorizontal: theme.layout.screenPaddingX,
                    // The keypad brings its own bottom inset; without it the footer keeps the old one.
                    paddingBottom: session === null ? insets.bottom + 16 : 16,
                    paddingTop: 4,
                    gap: 8,
                  }}
                >
                  {footer}
                </View>
              </View>
            )}
            {session === null ? null : (
              <View style={{ paddingBottom: insets.bottom + theme.layout.keypadPaddingY }}>
                <AmountKeypad
                  key={session.id}
                  session={session}
                  negative={session.isNegative()}
                  onLayoutHeight={setPadHeight}
                />
              </View>
            )}
          </View>
        )}
```

`version` is read so the pad re-renders after every press (the sign key's fill depends on it):

```tsx
  void version;
```

- [ ] **Step 4: Run the tests (they still fail: `AmountInput` has not been rewritten)**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- AmountKeypad`
Expected: FAIL — the field does not open the pad yet. Task 8 makes these pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/Screen.tsx apps/mobile/src/components/keypad/AmountKeypad.test.tsx
git commit -m "feat(mobile): the screen hosts the amount keypad under its footer"
```

---

## Task 8: `AmountInput` — sign tile, no soft keyboard

**Files:**
- Modify: `apps/mobile/src/components/AmountInput.tsx`
- Test: `apps/mobile/src/components/AmountInput.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AmountInput } from './AmountInput';
import { Screen } from './Screen';

jest.mock('../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function show(props: Partial<React.ComponentProps<typeof AmountInput>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <Screen>
          <AmountInput
            testID="amount"
            buffer=""
            onChange={jest.fn()}
            currency="EUR"
            locale="it"
            label="Saldo"
            doneLabel="Fatto"
            {...props}
          />
        </Screen>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('AmountInput', () => {
  it('never opens the device keyboard: the keypad is the only way in', async () => {
    await show();
    expect(screen.getByTestId('amount').props.showSoftInputOnFocus).toBe(false);
  });

  it('shows the buffer with the language separator', async () => {
    await show({ buffer: '1234.5' });
    expect(screen.getByTestId('amount').props.value).toBe('1234,5');
  });

  it('keeps the sign out of the digits, so they never shift', async () => {
    await show({ buffer: '-12.34', allowNegative: true, negativeLabel: 'Negativo' });
    expect(screen.getByTestId('amount').props.value).toBe('12,34');
    expect(screen.getByRole('switch', { name: 'Negativo' })).toBeChecked();
  });

  it('still reads the sign to a screen reader', async () => {
    await show({ buffer: '-12.34', allowNegative: true, negativeLabel: 'Negativo' });
    expect(screen.getByTestId('amount').props.accessibilityValue).toEqual({ text: '−12,34' });
  });

  it('offers the sign tile only where a balance may be negative', async () => {
    await show({ buffer: '12' });
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('flips the sign from the tile, with the keypad closed', async () => {
    const onChange = jest.fn();
    await show({ buffer: '12', onChange, allowNegative: true, negativeLabel: 'Negativo' });
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
    await userEvent.press(screen.getByRole('switch', { name: 'Negativo' }));
    expect(onChange).toHaveBeenCalledWith('-12');
  });

  it('keeps a pinned keypad up when the field is left', async () => {
    await show({ keypadPinned: true, keypadActionLabel: 'Continua', onKeypadAction: jest.fn() });
    await userEvent.press(screen.getByTestId('amount'));
    expect(screen.getByTestId('keypad-action')).toHaveTextContent('Continua');
    await userEvent.press(screen.getByTestId('keypad-action'));
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- AmountInput`
Expected: FAIL — `showSoftInputOnFocus` is undefined, no sign tile.

- [ ] **Step 3: Rewrite the component**

```tsx
import {
  amountBufferToMinor,
  type AmountKeypadKey,
  type CurrencyCode,
  getCurrency,
  pressAmountKey,
  sanitizeAmountInput,
  toggleAmountBufferSign,
} from '@saldo/core';
import { type AppLocale, formatMoneyParts } from '@saldo/i18n';
import { motion } from '@saldo/ui';
import { useCallback, useEffect, useId, useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SWAP_EASE, useMotion } from '../theme/motion';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { useAmountKeypad } from './keypad/AmountKeypadProvider';

export interface AmountInputProps {
  /** Locale-agnostic buffer using `.` (§5.1). */
  buffer: string;
  onChange: (buffer: string) => void;
  currency: CurrencyCode;
  locale: AppLocale;
  autoFocus?: boolean;
  /** What the field holds — "Amount", "Balance" — which is also what a screen reader announces. */
  label: string;
  /** Label of the keypad's tall key when nothing else is given. */
  doneLabel: string;
  onDone?: () => void;
  /**
   * A balance can be below zero (§5.1). The sign then sits in front of the digits as a tile that
   * reads the state and toggles it, and the keypad grows a `−` key.
   */
  allowNegative?: boolean;
  /** What the sign tile announces, e.g. "Negative". Required with `allowNegative`. */
  negativeLabel?: string;
  /** The onboarding steps keep the keypad up: their tall key continues the flow (§6.29). */
  keypadPinned?: boolean;
  keypadActionLabel?: string;
  onKeypadAction?: () => void;
  /** Identifier for the field itself, so an end-to-end flow can aim at it (`apps/mobile/maestro`). */
  testID?: string;
}

/**
 * Amount entry on **Saldo's own keypad** (§5.1): a field styled as the big amount, with the currency
 * symbol beside it and the keypad at the bottom of the screen. The device keyboard never opens —
 * `showSoftInputOnFocus={false}` — but the field stays a `TextInput`, so it keeps a caret, text
 * selection and the semantics a screen reader expects, and a hardware keyboard still types into it.
 *
 * The field shows the raw buffer rather than a grouped number: re-formatting text while someone
 * types moves the caret and fights them. Grouping is applied everywhere the amount is *displayed*.
 */
export function AmountInput({
  buffer,
  onChange,
  currency,
  locale,
  autoFocus = false,
  label,
  doneLabel,
  onDone,
  allowNegative = false,
  negativeLabel,
  keypadPinned = false,
  keypadActionLabel,
  onKeypadAction,
  testID,
}: AmountInputProps) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const field = useRef<View>(null);
  const id = useId();
  const keypad = useAmountKeypad();
  const { minorDigits } = getCurrency(currency);
  const parts = formatMoneyParts(amountBufferToMinor(buffer, minorDigits), currency, locale);
  const separator = locale === 'it' ? ',' : '.';
  const negative = buffer.startsWith('-');
  const body = negative ? buffer.slice(1) : buffer;
  const shown = body.replace('.', separator);

  // The keypad holds one session per field; these refs keep it pointing at the current props
  // without rebuilding the session (and re-mounting the pad) on every keystroke.
  const state = useRef({ buffer, onChange, onDone, onKeypadAction });
  state.current = { buffer, onChange, onDone, onKeypadAction };

  const open = useCallback(() => {
    keypad.open({
      id,
      allowNegative,
      separator: minorDigits === 0 ? null : separator,
      negativeLabel,
      actionLabel: keypadActionLabel ?? doneLabel,
      pinned: keypadPinned,
      node: field,
      isNegative: () => state.current.buffer.startsWith('-'),
      onKey: (key: AmountKeypadKey) => {
        state.current.onChange(
          pressAmountKey(state.current.buffer, key, minorDigits, { allowNegative }),
        );
        keypad.bump();
      },
      onAction: () => {
        if (state.current.onKeypadAction !== undefined) {
          state.current.onKeypadAction();
          return;
        }
        input.current?.blur();
        keypad.close(id);
        state.current.onDone?.();
      },
    });
  }, [
    keypad, id, allowNegative, minorDigits, separator, negativeLabel,
    keypadActionLabel, doneLabel, keypadPinned,
  ]);

  useEffect(() => {
    if (autoFocus) open();
    return () => keypad.close(id);
    // Opening once on mount is the point; `open` changes only with the field's own configuration.
  }, [autoFocus, open, keypad, id]);

  return (
    <Pressable
      ref={field}
      // Tapping beside the digits focuses them, which is a convenience for a pointing finger and
      // nothing more: a `Pressable` is accessible by default, and one wrapped round a field hides
      // the field from assistive technology entirely.
      accessible={false}
      onPress={() => {
        input.current?.focus();
        open();
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        {allowNegative ? (
          <SignTile
            negative={negative}
            label={negativeLabel}
            onPress={() => onChange(toggleAmountBufferSign(buffer))}
          />
        ) : null}
        {parts.symbolPosition === 'prefix' ? (
          <Text size="amountXl" weight="semibold" color="textFaint">
            {parts.symbol}
          </Text>
        ) : null}
        <TextInput
          ref={input}
          testID={testID}
          accessibilityLabel={label}
          // The sign lives in the tile, so the digits never shift when it flips; the value a screen
          // reader hears keeps it (§5.1 shows the sign as U+2212).
          accessibilityValue={allowNegative ? { text: `${negative ? '−' : ''}${shown}` } : undefined}
          value={shown}
          onChangeText={(text) => {
            const next = sanitizeAmountInput(text, minorDigits);
            onChange(negative && next.length > 0 ? `-${next}` : next);
          }}
          onFocus={open}
          // Saldo draws the keys; the device keyboard would cover them with its own.
          showSoftInputOnFocus={false}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor={theme.palette.textFaint}
          style={{
            flex: 1,
            minWidth: 80,
            paddingVertical: 0,
            color: theme.palette.text,
            fontFamily: 'Geist_600SemiBold',
            fontSize: theme.fontSize.amountXl,
            fontVariant: ['tabular-nums'],
          }}
        />
        {parts.symbolPosition === 'suffix' ? (
          <Text size="amountXl" weight="semibold" color="textFaint">
            {parts.symbol}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The sign in front of the digits: a faint `+` that becomes a full-weight `−`. The vertical stroke
 * collapses rather than the glyph swapping, so the change reads as one movement; colour carries it
 * on its own when Reduce Motion is on.
 */
function SignTile({
  negative,
  label,
  onPress,
}: {
  negative: boolean;
  label?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { duration } = useMotion();
  const open = useSharedValue(negative ? 0 : 1);

  useEffect(() => {
    open.value = withTiming(negative ? 0 : 1, {
      duration: duration(motion.toggleMs),
      easing: SWAP_EASE,
    });
  }, [negative, open, duration]);

  const stroke = useAnimatedStyle(() => ({ opacity: open.value, transform: [{ scaleY: open.value }] }));
  const colour = negative ? theme.palette.text : theme.palette.textFaint;
  const bar = { position: 'absolute', borderRadius: 2, backgroundColor: colour } as const;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: negative }}
      // A 30×40 tile beside a 38pt line; the slop brings the target to 44.
      hitSlop={{ top: 2, bottom: 2, left: 7, right: 7 }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: theme.layout.signTileWidth,
        height: theme.layout.signTileHeight,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.chipSmall,
        backgroundColor: theme.palette.raised,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[bar, { width: 18, height: 3.5 }]} />
        <Animated.View style={[bar, { width: 3.5, height: 18 }, stroke]} />
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Add `SWAP_EASE` to the motion module**

In `apps/mobile/src/theme/motion.ts`, beside `export const EASE`:

```ts
/** The swap curve of `motion.swapEasing`: a state replacing another one in place. */
export const SWAP_EASE = Easing.bezier(...motion.swapEasing);
```

(If a private `SWAP_EASE` already exists in that file, export it instead of declaring a second one.)

- [ ] **Step 5: Run both suites**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- AmountInput AmountKeypad`
Expected: PASS, all tests in both files.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/components/AmountInput.tsx apps/mobile/src/components/AmountInput.test.tsx apps/mobile/src/theme/motion.ts
git commit -m "feat(mobile): the amount field opens Saldo's keypad and wears its own sign"
```

---

## Task 9: The onboarding steps keep the pad up

**Files:**
- Modify: `apps/mobile/src/features/onboarding/StepFooter.tsx`
- Modify: `apps/mobile/app/(onboarding)/balance.tsx`
- Modify: `apps/mobile/app/(onboarding)/import-balances.tsx`

- [ ] **Step 1: Let `StepFooter` step aside for the keypad**

In `StepFooter.tsx`, import the context and hide the primary button while a keypad is up (the keypad's tall key is the
step's «Continua»), keeping «Indietro»:

```tsx
import { useAmountKeypad } from '../../components/keypad/AmountKeypadProvider';
```

Inside the component, after `const { t } = useTranslation();`:

```tsx
  // On the steps that own a keypad the tall key is «Continua»; a second one here would be the same
  // button twice. «Indietro» stays, so the way back never disappears.
  const { session } = useAmountKeypad();
```

and wrap the primary button:

```tsx
      {session === null ? (
        <View style={{ flex: 1 }}>
          <PrimaryButton label={label} {...rest} />
        </View>
      ) : null}
```

- [ ] **Step 2: Pin the pad on the balance step**

In `app/(onboarding)/balance.tsx`, extract the continue handler and pass it to the field:

```tsx
  const goOn = () => {
    setDraft({ balanceBuffer: buffer, currency });
    router.push('/categories');
  };
```

The `StepFooter` keeps `onPress={goOn}`, and the field gains:

```tsx
                keypadPinned
                keypadActionLabel={t('common.continue')}
                onKeypadAction={goOn}
```

- [ ] **Step 3: Pin the pad on the import-balances step**

In `app/(onboarding)/import-balances.tsx`, the same shape:

```tsx
  const goOn = () => {
    setDraft({ importBalanceBuffers: buffers });
    router.push('/permissions');
  };
```

with `StepFooter … onPress={goOn}` and, on every `AmountInput` in the list:

```tsx
                  keypadPinned
                  keypadActionLabel={t('common.continue')}
                  onKeypadAction={goOn}
```

- [ ] **Step 4: Run the onboarding tests**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- onboarding`
Expected: PASS. If a test asserted «Continua» exactly once while a field was focused, update it to look for
`keypad-action`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/onboarding/StepFooter.tsx "apps/mobile/app/(onboarding)/balance.tsx" "apps/mobile/app/(onboarding)/import-balances.tsx"
git commit -m "feat(mobile): the onboarding amount steps continue from the keypad"
```

---

## Task 10: Accessibility tests

**Files:**
- Modify: `apps/mobile/src/components/a11y.test.tsx`

- [ ] **Step 1: Update the `AmountInput` block**

The field renders inside a `Screen` now (that is what hosts the keypad), the switch is the sign tile, and the value no
longer carries the minus. Replace the `describe('AmountInput', …)` block with:

```tsx
describe('AmountInput', () => {
  function Field(props: Partial<React.ComponentProps<typeof AmountInput>>) {
    return (
      <Host>
        <Screen>
          <AmountInput
            testID="amount"
            buffer="12.34"
            onChange={jest.fn()}
            currency="EUR"
            locale="en"
            label="Amount"
            doneLabel="Done"
            {...props}
          />
        </Screen>
      </Host>
    );
  }

  it('names the field for what it holds, not for the key that dismisses it', async () => {
    await render(<Field />);
    expect(screen.getByLabelText('Amount').props.value).toBe('12.34');
  });

  it('leaves the field reachable through the box that focuses it', async () => {
    await render(<Field />);
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Amount' })).toBeNull();
  });

  it('offers no sign switch unless the amount may be negative', async () => {
    await render(<Field />);
    expect(screen.queryByRole('switch', { name: 'Negative' })).toBeNull();
  });

  it('shows a negative balance with a checked sign switch and reads the minus out', async () => {
    await render(<Field buffer="-12.34" allowNegative negativeLabel="Negative" />);
    expect(screen.getByRole('switch', { name: 'Negative' })).toBeChecked();
    expect(screen.getByLabelText('Amount').props.accessibilityValue).toEqual({ text: '−12.34' });
  });

  it('flips the sign from the switch', async () => {
    const onChange = jest.fn();
    await render(<Field buffer="-12.34" onChange={onChange} allowNegative negativeLabel="Negative" />);
    await userEvent.press(screen.getByRole('switch', { name: 'Negative' }));
    expect(onChange).toHaveBeenCalledWith('12.34');
  });

  it('gives the sign switch and every key a 44pt target', async () => {
    await render(<Field allowNegative negativeLabel="Negative" />);
    await userEvent.press(screen.getByLabelText('Amount'));
    const sign = touchTarget(screen.getByRole('switch', { name: 'Negative' }));
    expect(sign.width).toBeGreaterThanOrEqual(MIN);
    expect(sign.height).toBeGreaterThanOrEqual(MIN);
    const seven = touchTarget(screen.getByTestId('keypad-key-7'));
    expect(seven.height).toBeGreaterThanOrEqual(MIN);
  });

  it('exposes one sign switch only: the keypad key is the tile's shortcut, not a second control', async () => {
    await render(<Field allowNegative negativeLabel="Negative" />);
    await userEvent.press(screen.getByLabelText('Amount'));
    expect(screen.getAllByRole('switch', { name: 'Negative' })).toHaveLength(1);
  });

  it('names the keys that are glyphs', async () => {
    await render(<Field />);
    await userEvent.press(screen.getByLabelText('Amount'));
    expect(screen.getByLabelText('Delete')).toBeTruthy();
    expect(screen.getByLabelText('Decimal point')).toBeTruthy();
  });
});
```

Add the imports the block needs at the top of the file (`Screen`, and `userEvent` if it is not already imported).

- [ ] **Step 2: Run it**

Run: `rtk proxy pnpm --filter @saldo/mobile test -- a11y`
Expected: PASS. `keypadKeyHeight` is 52, so the target check passes without slop.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/a11y.test.tsx
git commit -m "test(mobile): the keypad and the sign tile answer to a screen reader"
```

---

## Task 11: End-to-end flows type on the keypad

**Files:**
- Modify: `apps/mobile/maestro/onboarding-and-first-expense.yaml`
- Modify: `apps/mobile/maestro/edit-recurring-following.yaml`

`inputText` needs a system keyboard, and there is none any more.

- [ ] **Step 1: Replace the balance entry in `onboarding-and-first-expense.yaml`**

```yaml
- tapOn:
    id: "onboarding-balance-amount"
- tapOn:
    id: "keypad-key-1"
- tapOn:
    id: "keypad-key-0"
- tapOn:
    id: "keypad-key-0"
- tapOn:
    id: "keypad-key-0"
```

- [ ] **Step 2: Replace the amount entry in the same file (12.50)**

```yaml
- tapOn:
    id: "txform-amount"
- tapOn:
    id: "keypad-key-1"
- tapOn:
    id: "keypad-key-2"
- tapOn:
    id: "keypad-key-separator"
- tapOn:
    id: "keypad-key-5"
- tapOn:
    id: "keypad-action"
```

- [ ] **Step 3: Replace the amount entry in `edit-recurring-following.yaml` (200)**

```yaml
- tapOn:
    id: "txform-amount"
- tapOn:
    id: "keypad-key-2"
- tapOn:
    id: "keypad-key-0"
- tapOn:
    id: "keypad-key-0"
- tapOn:
    id: "keypad-action"
```

- [ ] **Step 4: Commit** (the flows run on a device, not in CI here)

```bash
git add apps/mobile/maestro
git commit -m "test(mobile): maestro types amounts on the keypad"
```

---

## Task 12: The spec says what the app does

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`

- [ ] **Step 1: Rewrite D23 (line 77)**

```markdown
| D23 | Amounts are typed on **Saldo's own keypad**, not on the device keyboard | The keys are then the same on both platforms, the decimal separator follows the *app's* language instead of the device's, and a balance gets a `−` key where a calculator has one — none of which `decimal-pad` can offer (it has no minus key on iOS, and Android has no `InputAccessoryView` to add one). The field stays a `TextInput` with `showSoftInputOnFocus={false}`, so it keeps its caret, its selection and its screen-reader semantics, and a hardware keyboard still types into it; `sanitizeAmountInput` still accepts `.` and `,` for those edits and for imports. The cost is the ~270pt the pad occupies, which is why the screens that own one reserve it (`Screen`) and the onboarding steps keep it up. |
```

- [ ] **Step 2: Rewrite the two §5.1 bullets (lines 295–296 and 305)**

```markdown
- **Input is Saldo's own keypad** (D23), not the device's: 3 digit columns, `⌫` and a tall action key
  («Fatto», «Continua» on an onboarding step), and a `−` key on a field that allows one.
  `pressAmountKey(buffer, key, minorDigits, { allowNegative })` applies each press and
  `sanitizeAmountInput(text, minorDigits)` normalises anything that arrives as text (a hardware keyboard, a paste, an
  import): it accepts `.` or `,`, treats only the first separator as the decimal point, drops anything that is not a
  digit or separator, strips leading zeros while keeping a lone `0`, and enforces max **8 significant digits** split by
  the currency scale — `maxIntegerDigits = 8 − minorDigits`, so 6 + 2 for EUR, 8 + 0 for JPY, 5 + 3 for KWD. A
  0-decimal currency gets no separator key at all.
```

and

```markdown
- **Balances can be negative** (account sheet §6.22, onboarding step 3); transaction and budget amounts cannot. A
  balance field opts in with `allowNegative`: the buffer carries a leading `-` (a lone `-` reads as 0) and the sign is
  drawn **in front of the digits** as a tile that reads the state and toggles it — a faint `+` that becomes a
  full-weight `−` — so the state is readable and changeable with the keypad closed. The tile is the `switch`
  ("Negativo", checked when negative) that assistive technology drives; the keypad's `−` key is the same action for the
  typing thumb and is hidden from it. The digits themselves never carry the sign, so they do not shift when it flips.
  `minorToAmountBuffer` keeps the sign, so editing a credit card below zero keeps it below zero.
```

- [ ] **Step 3: Fix §6.16 (line 589) — replace the sentence about the amount field**

```markdown
The amount is the big figure, focused automatically on a new transaction, typed on Saldo's keypad (D23); there is no separate save column.
```

- [ ] **Step 4: Fix §6.22 (line 595) — replace `(`±` switch, §5.1)` with**

```markdown
(sign tile in front of the digits, §5.1)
```

- [ ] **Step 5: Check no other line still promises the device keyboard**

Run: `rtk proxy grep -n "decimal-pad\|in-app keypad\|device keyboard" docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`
Expected: only the rewritten D23 mentions `decimal-pad`, and only to say it is not used.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-10-saldo-poc-spec.md
git commit -m "docs(spec): D23 reversed — amounts are typed on Saldo's keypad"
```

---

## Task 13: Gates, TODO, plan boxes

**Files:**
- Modify: `TODO.md`, this plan

- [ ] **Step 1: Run the three gates and read the output, not the exit code**

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines, no `× Some errors were emitted`, every suite green.

- [ ] **Step 2: Remove the TODO item**

Delete the whole "### A better sign switch on the balance field" section from `TODO.md` (heading, checkbox and the two
paragraphs), leaving the surrounding sections untouched.

- [ ] **Step 3: Tick every box in this plan and commit**

```bash
git add TODO.md docs/superpowers/plans/2026-09-22-amount-keypad.md
git commit -m "docs(todo): the sign switch shipped as the amount keypad"
```

---

## On-device checklist (the user runs this)

Every screen with an amount field, iOS and Android, light and dark, and once with Reduce Motion on:

1. **New transaction** (`transaction/new`) — pad opens with the sheet, «Fatto» closes it, save still guarded by amount > 0.
2. **Edit transaction** (`transaction/edit/[id]`) — tapping the figure reopens the pad on the existing amount.
3. **New / edit account** (`account/new`, `account/edit/[id]`) — sign tile flips a balance with the pad closed and open; credit card below zero round-trips.
4. **New / edit budget** (`budget/new`, `budget/[id]`) — median suggestion still fills the field.
5. **Category monthly budget** (`category/new`, `category/edit/[id]`) — the pad appears only once the budget toggle is on.
6. **Onboarding step 3, balance** — pad is up from the start, «Continua» on the tall key, «Indietro» still in the footer.
7. **Onboarding import balances** — three fields, pad follows the focused card, list scrolls the focused card clear of the pad.
8. **A currency with no decimals (JPY) and one with three (KWD)** — separator key absent / three decimals accepted.
9. **VoiceOver / TalkBack** — the field reads its value with the minus, one "Negativo" switch, every key named.
