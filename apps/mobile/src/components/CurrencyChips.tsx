import { COMMON_CURRENCY_CODES, type CurrencyCode } from '@saldo/core';
import { Pressable, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface CurrencyChipsProps {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
}

/** The four common currencies as one row of chips, for onboarding (§6.29). */
export function CurrencyChips({ value, onChange }: CurrencyChipsProps) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
      {COMMON_CURRENCY_CODES.map((code) => {
        const selected = code === value;
        return (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            // The row of codes is 38pt tall; it is already wide, so only the height grows.
            hitSlop={{ top: 3, bottom: 3 }}
            onPress={() => onChange(code)}
            style={{
              flex: 1,
              height: 38,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.chipSmall,
              backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
            }}
          >
            <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
              {code}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
