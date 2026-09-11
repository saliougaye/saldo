import type { DateRange, LocalDate } from '@saldo/core';
import { formatLongDate } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton } from '../../components/Button';
import { Calendar } from '../../components/Calendar';
import { Sheet } from '../../components/Sheet';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * §6.15 "Periodo personalizzato": any range the user wants, not just a whole period.
 *
 * The same `Calendar` the transaction form uses, in its range mode — a second calendar would be a
 * second set of rules about what "today" looks like and where the week starts.
 */
export function CustomRangeSheet({
  visible,
  initial,
  today,
  onApply,
  onClose,
}: {
  visible: boolean;
  initial: DateRange;
  today: LocalDate;
  onApply: (range: DateRange) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useAppLocale();
  const [range, setRange] = useState<DateRange>(initial);
  // Which end the next tap sets. After both ends are placed the next tap starts a new range,
  // which is what every date-range picker does and what makes a mis-tap cheap to undo.
  const [picking, setPicking] = useState<'start' | 'end'>('start');

  const select = (date: LocalDate) => {
    if (picking === 'start' || date < range.start) {
      setRange({ start: date, end: date });
      setPicking('end');
      return;
    }
    setRange({ start: range.start, end: date });
    setPicking('start');
  };

  const end = (label: string, value: LocalDate, side: 'start' | 'end') => {
    const active = picking === side;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => setPicking(side)}
        style={{
          flex: 1,
          gap: 2,
          padding: 10,
          borderRadius: theme.radii.input,
          borderWidth: 1,
          borderColor: active ? theme.palette.borderStrong : theme.palette.border,
          backgroundColor: active ? theme.palette.raised : 'transparent',
        }}
      >
        <Text size="caption" color="textFaint">
          {label}
        </Text>
        <Text size="footnote" tabular numberOfLines={1}>
          {formatLongDate(value, locale)}
        </Text>
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('period.custom')} tall>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {end(t('period.customFrom'), range.start, 'start')}
          {end(t('period.customTo'), range.end, 'end')}
        </View>
        <Calendar value={range} today={today} onSelect={select} />
        <PrimaryButton
          label={t('common.done')}
          onPress={() => {
            onApply(range);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
