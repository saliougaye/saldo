import {
  amountBufferToMinor,
  type CurrencyCode,
  getCurrency,
  sanitizeAmountInput,
  toggleAmountBufferSign,
} from '@saldo/core';
import { type AppLocale, formatMoneyParts } from '@saldo/i18n';
import { useRef } from 'react';
import { InputAccessoryView, Platform, Pressable, TextInput, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface AmountInputProps {
  /** Locale-agnostic buffer using `.` (§5.1). */
  buffer: string;
  onChange: (buffer: string) => void;
  currency: CurrencyCode;
  locale: AppLocale;
  autoFocus?: boolean;
  /** What the field holds — "Amount", "Balance" — which is also what a screen reader announces. */
  label: string;
  /** Label for the accessory bar's dismiss button. */
  doneLabel: string;
  onDone?: () => void;
  /**
   * A balance can be below zero. The device's `decimal-pad` has no minus key on iOS, so this adds a
   * `±` switch before the amount; a typed or pasted minus is kept as well.
   */
  allowNegative?: boolean;
  /** What the sign switch announces, e.g. "Negative". Required with `allowNegative`. */
  negativeLabel?: string;
  /** Identifier for the field itself, so an end-to-end flow can aim at it (`apps/mobile/maestro`). */
  testID?: string;
}

/**
 * Amount entry on the **device keyboard** (D23): a `decimal-pad` field styled as the big amount,
 * with the currency symbol beside it.
 *
 * The field shows the raw buffer rather than a grouped number: re-formatting text while someone
 * types moves the caret and fights them. Grouping is applied everywhere the amount is *displayed*.
 *
 * iOS gets an `InputAccessoryView` with a done button, which is the platform way to extend the
 * keyboard. Android has no equivalent primitive, so there the keyboard's own dismiss key and the
 * form's save button do the job.
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
  testID,
}: AmountInputProps) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const accessoryId = 'saldo-amount-accessory';
  const { minorDigits } = getCurrency(currency);
  const parts = formatMoneyParts(amountBufferToMinor(buffer, minorDigits), currency, locale);
  const separator = parts.decimalSeparator;
  const negative = buffer.startsWith('-');

  return (
    // Tapping beside the digits focuses them, which is a convenience for a pointing finger and
    // nothing more: a `Pressable` is accessible by default, and one wrapped round a field hides
    // the field from assistive technology entirely.
    <Pressable accessible={false} onPress={() => input.current?.focus()}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        {allowNegative ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={negativeLabel}
            accessibilityState={{ checked: negative }}
            // 36pt beside a 38pt amount; the slop brings the target to 44.
            hitSlop={4}
            onPress={() => onChange(toggleAmountBufferSign(buffer))}
            style={{
              width: 36,
              height: 36,
              alignSelf: 'center',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.chipSmall,
              backgroundColor: negative ? theme.palette.accent : theme.palette.raised,
            }}
          >
            <Text size="headline" weight="semibold" color={negative ? 'onAccent' : 'text'}>
              ±
            </Text>
          </Pressable>
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
          // The buffer stores `-`; the field shows the typographic minus every amount uses (§5.1).
          value={buffer.replace('-', '\u2212').replace('.', separator)}
          onChangeText={(text) =>
            onChange(sanitizeAmountInput(text, minorDigits, { allowNegative }))
          }
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor={theme.palette.textFaint}
          inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
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

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: theme.layout.screenPaddingX,
              paddingVertical: 8,
              backgroundColor: theme.palette.raised,
              borderTopWidth: 1,
              borderTopColor: theme.palette.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              // One line of body text in a thin accessory bar: the slop is the whole target.
              hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
              onPress={() => {
                input.current?.blur();
                onDone?.();
              }}
            >
              <Text weight="medium" color="accent">
                {doneLabel}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Pressable>
  );
}
