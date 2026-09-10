import {
  elapsedDays,
  periodHistory,
  periodLength,
  previousPeriods,
  summarizePeriod,
} from '@saldo/core';
import { formatCycleRange, formatMoney } from '@saldo/i18n';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { useRepositories } from '../../db/DatabaseProvider';
import { useSettings, useTransactionsInRange } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { CustomRangeSheet } from './CustomRangeSheet';
import { CycleStartDaySheet } from './CycleStartDaySheet';
import { PeriodKindSheet } from './PeriodKindSheet';
import { usePeriod } from './PeriodProvider';

/** How far back the sheet looks for periods that hold data (§6.15). */
const LOOKBACK = 12;

/**
 * §6.15, the design's bottom sheet: the periods that contain data, then the three ways to change
 * what a period even is — an arbitrary range, the kind, and (for a pay cycle) its start day.
 *
 * The prototype's "not available offline" rows are dropped: everything is local.
 */
export function PeriodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const theme = useTheme();
  const repos = useRepositories();
  const settings = useSettings();
  const currency = settings?.currency ?? 'EUR';
  const { today, def, period, goToPeriod, setCustomRange, resetToCurrent } = usePeriod();
  const [kindOpen, setKindOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);

  const oldest = previousPeriods(def, period.range, LOOKBACK).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(oldest, period.range.end);

  const periods = useMemo(() => {
    const past = periodHistory(rows, def, period.range, LOOKBACK);
    return [
      { period: period.range, txs: rows.filter((tx) => tx.date >= period.range.start) },
      ...past,
    ];
  }, [rows, period.range, def]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('period.title')}>
      <View>
        {periods.map((entry) => {
          const isCurrent = today >= entry.period.start && today <= entry.period.end;
          const selected =
            entry.period.start === period.range.start && entry.period.end === period.range.end;
          const spent = summarizePeriod(entry.txs, entry.period, today).spent;
          return (
            <ListRow
              key={entry.period.start}
              title={formatCycleRange(entry.period, locale)}
              subtitle={
                isCurrent
                  ? t('period.inProgress', {
                      elapsed: elapsedDays(entry.period, today),
                      length: periodLength(entry.period),
                    })
                  : t('period.spent', { amount: formatMoney(spent, currency, locale) })
              }
              trailing={
                selected && period.isPeriod ? (
                  <Icon name="check" size={18} color={theme.palette.accent} />
                ) : undefined
              }
              onPress={() => {
                goToPeriod(entry.period);
                onClose();
              }}
            />
          );
        })}
        {periods.length === 1 ? (
          <Text size="footnote" color="textFaint" style={{ paddingVertical: 8 }}>
            {t('transactions.empty')}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: 8,
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopColor: theme.palette.border,
          }}
        >
          <ListRow title={t('period.custom')} chevron onPress={() => setRangeOpen(true)} />
          <ListRow
            title={t('period.kind')}
            trailing={<Text color="textMuted">{t(`period.kind_${def.kind}`)}</Text>}
            chevron
            onPress={() => setKindOpen(true)}
          />
          {def.kind === 'cycle' ? (
            <ListRow
              title={t('period.cycleStartDay')}
              trailing={<Text color="textMuted">{String(def.startDay)}</Text>}
              chevron
              onPress={() => setDayOpen(true)}
            />
          ) : null}
        </View>
      </View>

      <PeriodKindSheet
        visible={kindOpen}
        selected={def.kind}
        onSelect={(kind) => {
          repos.settings.update({ periodKind: kind });
          // The stored range belongs to the old kind, so it stops being a period at all: fall
          // back to the one containing today rather than showing a range of the wrong shape.
          resetToCurrent();
        }}
        onClose={() => setKindOpen(false)}
      />
      <CycleStartDaySheet
        visible={dayOpen}
        selected={def.startDay}
        onSelect={(day) => {
          repos.settings.update({ cycleStartDay: day });
          // Same reason as a changed kind: the stored range belongs to the old start day.
          resetToCurrent();
        }}
        onClose={() => setDayOpen(false)}
      />
      <CustomRangeSheet
        visible={rangeOpen}
        initial={period.range}
        onApply={(range) => {
          setCustomRange(range);
          onClose();
        }}
        onClose={() => setRangeOpen(false)}
      />
    </Sheet>
  );
}
