import { formatCycleRange, formatDayMonth } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { usePeriod } from './PeriodProvider';
import { PeriodSheet } from './PeriodSheet';

/** Header of §6.1: the period label with its subtitle, plus ‹ › cycle navigation. */
export function PeriodHeader() {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { period, shift } = usePeriod();
  const [sheetOpen, setSheetOpen] = useState(false);

  const label = period.isPeriod
    ? formatCycleRange(period.range, locale)
    : `${formatDayMonth(period.range.start, locale)} – ${formatDayMonth(period.range.end, locale)}`;
  const subtitle = period.isCurrent
    ? t('period.dayOf', { elapsed: period.elapsed, length: period.length })
    : t('period.closed');

  const navButton = (direction: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === -1 ? t('period.previous') : t('period.next')}
      hitSlop={10}
      onPress={() => shift(direction)}
      style={{
        width: theme.layout.headerButton,
        height: theme.layout.headerButton,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.raised,
      }}
    >
      <Icon name={direction === -1 ? 'chevL' : 'chevR'} size={16} color={theme.palette.textMuted} />
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('period.title')}
        onPress={() => setSheetOpen(true)}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Text weight="medium" tracking="tight" numberOfLines={1}>
          {label}
        </Text>
        <Text size="caption" color="textMuted">
          {subtitle}
        </Text>
      </Pressable>
      {navButton(-1)}
      {navButton(1)}
      <PeriodSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
