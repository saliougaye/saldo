import { COMMON_CURRENCY_CODES, type CurrencyCode } from '@saldo/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';
import { CurrencySheet } from './CurrencySheet';

export interface CurrencyChipsProps {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
}

/**
 * The four common currencies as one row of chips, for onboarding (§6.29), and a fifth that opens
 * every other one (§6.25). Once one of those is chosen the fifth chip shows its code, selected.
 */
export function CurrencyChips({ value, onChange }: CurrencyChipsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const common: readonly CurrencyCode[] = COMMON_CURRENCY_CODES;
  const otherSelected = !common.includes(value);
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {COMMON_CURRENCY_CODES.map((code) => (
          <CurrencyChip
            key={code}
            label={code}
            selected={code === value}
            onPress={() => onChange(code)}
          />
        ))}
        <CurrencyChip
          label={otherSelected ? value : t('currencyPicker.other')}
          selected={otherSelected}
          onPress={() => setOpen(true)}
        />
      </View>
      <CurrencySheet
        visible={open}
        onClose={() => setOpen(false)}
        value={value}
        onSelect={onChange}
      />
    </>
  );
}

function CurrencyChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // The row of codes is 38pt tall; it is already wide, so only the height grows.
      hitSlop={{ top: 3, bottom: 3 }}
      onPress={onPress}
      style={{
        flex: 1,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.chipSmall,
        backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
      }}
    >
      <Text size="footnote" color={selected ? 'onAccent' : 'text'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
