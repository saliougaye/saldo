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
  /** Label of the keypad's tall key when the screen asks for nothing else. */
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
 * Amount entry on **Saldo's own keypad** (§5.1, D23): the field is the big amount with the
 * currency symbol beside it, and the keys are drawn by {@link AmountKeypad} at the bottom of the
 * screen. The device keyboard never opens — `showSoftInputOnFocus={false}` — but the field stays a
 * `TextInput`, so it keeps its caret, its selection and the semantics a screen reader expects, and
 * a hardware keyboard still types into it.
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
  const separator = parts.decimalSeparator;
  const negative = buffer.startsWith('-');
  const shown = (negative ? buffer.slice(1) : buffer).replace('.', separator);

  // The keypad holds one session per field. These refs keep it pointing at the current props
  // without rebuilding the session — and re-mounting the pad — on every keystroke.
  const state = useRef({ buffer, onChange, onDone, onKeypadAction });
  state.current = { buffer, onChange, onDone, onKeypadAction };

  const open = useCallback(() => {
    keypad.open({
      id,
      allowNegative,
      separator: minorDigits === 0 ? null : separator,
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
    keypad,
    id,
    allowNegative,
    minorDigits,
    separator,
    keypadActionLabel,
    doneLabel,
    keypadPinned,
  ]);

  // Opening the pad changes the context, so neither the controller nor `open` can be a dependency
  // here: the cleanup would run on the very change the opening caused and close it again.
  const latest = useRef({ open, close: keypad.close });
  latest.current = { open, close: keypad.close };
  useEffect(() => {
    if (autoFocus) latest.current.open();
    return () => latest.current.close(id);
  }, [autoFocus, id]);

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
          // The sign lives in the tile, so the digits never shift when it flips; what a screen
          // reader hears keeps it, as the typographic minus of §5.1.
          accessibilityValue={
            allowNegative ? { text: `${negative ? '−' : ''}${shown}` } : undefined
          }
          value={shown}
          onChangeText={(text) => {
            // Only a hardware keyboard or a paste reaches this. The field shows no sign, so a
            // buffer that had one keeps it; a minus that arrives in the text still sets it.
            const typed = sanitizeAmountInput(text, minorDigits, { allowNegative });
            const keepsSign = allowNegative && negative && !typed.startsWith('-');
            onChange(keepsSign && typed.length > 0 ? `-${typed}` : typed);
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
 * collapses rather than one glyph swapping for another, so the change reads as a single movement;
 * the colour carries it on its own when Reduce Motion is on.
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
  const plus = useSharedValue(negative ? 0 : 1);

  useEffect(() => {
    plus.value = withTiming(negative ? 0 : 1, {
      duration: duration(motion.toggleMs),
      easing: SWAP_EASE,
    });
  }, [negative, plus, duration]);

  const stroke = useAnimatedStyle(() => ({
    opacity: plus.value,
    transform: [{ scaleY: plus.value }],
  }));
  const colour = negative ? theme.palette.text : theme.palette.textFaint;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: negative }}
      // A 30×40 tile beside a 38pt line: the slop brings the target to 44.
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
        <View
          style={{ position: 'absolute', width: 18, height: 3.5, borderRadius: 2, backgroundColor: colour }}
        />
        <Animated.View
          style={[
            { position: 'absolute', width: 3.5, height: 18, borderRadius: 2, backgroundColor: colour },
            stroke,
          ]}
        />
      </View>
    </Pressable>
  );
}
