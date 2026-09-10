import {
  cycleHistory,
  cycleLength,
  elapsedDays,
  previousCycles,
  summarizePeriod,
} from '@saldo/core';
import { formatCycleRange, formatMoney } from '@saldo/i18n';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { useSettings, useTransactionsInRange } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { usePeriod } from './PeriodProvider';

/** How far back the sheet looks for cycles that hold data (§6.15). */
const LOOKBACK = 12;

/**
 * §6.15: the cycles that contain data, current first. The prototype's "not available offline"
 * rows are dropped — everything is local.
 */
export function PeriodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const currency = settings?.currency ?? 'EUR';
  const { today, cycleStartDay, period, goToCycle } = usePeriod();

  const oldest =
    previousCycles(period.range, cycleStartDay, LOOKBACK).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(oldest, period.range.end);

  const cycles = useMemo(() => {
    const past = cycleHistory(rows, period.range, cycleStartDay, LOOKBACK);
    return [
      { cycle: period.range, txs: rows.filter((tx) => tx.date >= period.range.start) },
      ...past,
    ];
  }, [rows, period.range, cycleStartDay]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('period.title')}>
      <View>
        {cycles.map((entry) => {
          const isCurrent = today >= entry.cycle.start && today <= entry.cycle.end;
          const spent = summarizePeriod(entry.txs, entry.cycle, today).spent;
          return (
            <ListRow
              key={entry.cycle.start}
              title={formatCycleRange(entry.cycle, locale)}
              subtitle={
                isCurrent
                  ? t('period.inProgress', {
                      elapsed: elapsedDays(entry.cycle, today),
                      length: cycleLength(entry.cycle),
                    })
                  : t('period.spent', { amount: formatMoney(spent, currency, locale) })
              }
              onPress={() => {
                goToCycle(entry.cycle);
                onClose();
              }}
            />
          );
        })}
        {cycles.length === 1 ? (
          <Text size="footnote" color="textFaint" style={{ paddingVertical: 8 }}>
            {t('transactions.empty')}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
