import { type AmountKey, type MinorDigits, pressAmountKey } from '@saldo/core';
import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface KeypadProps {
  /** Locale-agnostic buffer using `.`; the key label shows `,` or `.` (§5.1). */
  buffer: string;
  onChange: (buffer: string) => void;
  minorDigits: MinorDigits;
  decimalSeparator: ',' | '.';
  saveLabel: string;
  onSave?: () => void;
  saveDisabled?: boolean;
}

const DIGITS: readonly AmountKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export function Keypad({
  buffer,
  onChange,
  minorDigits,
  decimalSeparator,
  saveLabel,
  onSave,
  saveDisabled = false,
}: KeypadProps) {
  const theme = useTheme();
  const press = (key: AmountKey) => onChange(pressAmountKey(buffer, key, minorDigits));

  const keyStyle = {
    flex: 1,
    height: theme.layout.keypadKeyHeight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: theme.radii.input,
    backgroundColor: theme.palette.raised,
  };

  return (
    <View style={{ gap: 6 }}>
      {DIGITS.map((row) => (
        <View key={row.join('')} style={{ flexDirection: 'row', gap: 6 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key}
              onPress={() => press(key)}
              style={keyStyle}
            >
              <Text size="amountKey" weight="medium" tabular>
                {key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {minorDigits === 0 ? (
          // A currency without a minor unit has no decimal key at all (§5.1).
          <View style={keyStyle} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={decimalSeparator}
            onPress={() => press('decimal')}
            style={keyStyle}
          >
            <Text size="amountKey" weight="medium">
              {decimalSeparator}
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="0"
          onPress={() => press('0')}
          style={keyStyle}
        >
          <Text size="amountKey" weight="medium" tabular>
            0
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="delete"
          onPress={() => press('del')}
          style={keyStyle}
        >
          <Icon name="del" size={20} color={theme.palette.text} />
        </Pressable>
      </View>
      {onSave === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saveDisabled }}
          disabled={saveDisabled}
          onPress={onSave}
          style={{
            height: theme.layout.keypadKeyHeight,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radii.input,
            backgroundColor: theme.palette.accent,
            opacity: saveDisabled ? 0.4 : 1,
          }}
        >
          <Text weight="medium" color="onAccent" size="headline">
            {saveLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
