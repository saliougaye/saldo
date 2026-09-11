import {
  addMonths,
  type DateRange,
  type LocalDate,
  monthGrid,
  parseLocalDate,
  type YearMonth,
} from '@saldo/core';
import { firstWeekdayFor, formatLongDate, formatMonthYear, weekdayLabels } from '@saldo/i18n';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useAppLocale } from '../i18n/useAppLocale';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

/** Tall enough to be its own hit target (`layout.minHitTarget`), which is what sets the grid size. */
const CELL_HEIGHT = 44;

export interface CalendarProps {
  /** A single day, or the range being picked — the calendar draws both the same way. */
  value: LocalDate | DateRange;
  onSelect: (date: LocalDate) => void;
  /** Ringed rather than filled, so "today" and "selected" stay two different things. */
  today: LocalDate;
  minDate?: LocalDate;
  maxDate?: LocalDate;
}

function monthOf(date: LocalDate): YearMonth {
  const { year, month } = parseLocalDate(date);
  return { year, month };
}

/**
 * The month grid Saldo draws itself, rather than the platform picker: the native one arrives in
 * its own typeface, its own radii and a different shape on each OS, and it cannot show a range.
 * Everything here comes from `@saldo/ui` tokens, and the week starts where the locale says (§13).
 */
export function Calendar({ value, onSelect, today, minDate, maxDate }: CalendarProps) {
  const theme = useTheme();
  const locale = useAppLocale();
  const { t } = useTranslation();
  const range = typeof value === 'string' ? { start: value, end: value } : value;
  const [visible, setVisible] = useState<YearMonth>(() => monthOf(range.start));
  const firstWeekday = firstWeekdayFor(locale);
  const grid = useMemo(() => monthGrid(visible, firstWeekday), [visible, firstWeekday]);
  const labels = weekdayLabels(locale, firstWeekday);

  const navButton = (name: 'chevL' | 'chevR', label: string, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => setVisible(addMonths(visible, delta))}
      style={({ pressed }) => ({
        width: theme.layout.headerButton,
        height: theme.layout.headerButton,
        borderRadius: theme.radii.chipSmall,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.raised,
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Icon name={name} size={16} color={theme.palette.textMuted} />
    </Pressable>
  );

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {navButton('chevL', t('calendar.previousMonth'), -1)}
        <Text weight="medium" tracking="tight">
          {formatMonthYear(visible, locale)}
        </Text>
        {navButton('chevR', t('calendar.nextMonth'), 1)}
      </View>

      <View
        style={{ flexDirection: 'row' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {(grid[0] ?? []).map((day, column) => (
          // Weekday initials repeat (L M M G V S D), so the heading is keyed by the day under it.
          <View key={day.date} style={{ flex: 1, alignItems: 'center', paddingBottom: 2 }}>
            <Text size="caption" color="textFaint">
              {labels[column]}
            </Text>
          </View>
        ))}
      </View>

      <View>
        {grid.map((week) => (
          <View key={week[0]?.date} style={{ flexDirection: 'row' }}>
            {week.map((day) => {
              const isStart = day.date === range.start;
              const isEnd = day.date === range.end;
              const selected = isStart || isEnd;
              const inRange = day.date > range.start && day.date < range.end;
              const disabled =
                (minDate !== undefined && day.date < minDate) ||
                (maxDate !== undefined && day.date > maxDate);
              const isToday = day.date === today;
              return (
                <Pressable
                  key={day.date}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={formatLongDate(day.date, locale)}
                  disabled={disabled}
                  onPress={() => onSelect(day.date)}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: CELL_HEIGHT,
                    alignItems: 'center',
                    justifyContent: 'center',
                    // The band between two ends is continuous: only the ends are rounded.
                    borderRadius: selected ? theme.radii.input : 0,
                    backgroundColor: selected
                      ? theme.palette.accent
                      : inRange
                        ? theme.palette.track
                        : 'transparent',
                    borderWidth: isToday && !selected ? 1 : 0,
                    borderColor: theme.palette.borderStrong,
                    opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
                    transform: [{ scale: pressed && !selected ? 0.96 : 1 }],
                  })}
                >
                  <Text
                    size="footnote"
                    tabular
                    weight={selected || isToday ? 'medium' : 'regular'}
                    color={selected ? 'onAccent' : day.inMonth ? 'text' : 'textFaint'}
                  >
                    {parseLocalDate(day.date).day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
