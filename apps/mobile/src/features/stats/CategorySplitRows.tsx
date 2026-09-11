import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { AmountText } from '../../components/AmountText';
import { IconBox, ListRow } from '../../components/ListRow';
import { appearing, leaving, reflowing } from '../../theme/motion';

/** One parent category of "Ripartizione" (§5.7), already rolled up and sorted by amount desc. */
export interface CategorySplitRow {
  id: string;
  name: string;
  icon: IconName;
  colour: string;
  amount: number;
  /** Percent against this category's usual spend, or `null` when it has no history. */
  delta: number | null;
  share: number;
}

/**
 * The category rows of "Ripartizione" (§5.7).
 *
 * The card shows the first few and the sheet shows every one, so the row lives here rather than in
 * the screen: the two lists have to read identically, or opening "see all" would look like
 * arriving somewhere else.
 */
export function CategorySplitRows({
  rows,
  currency,
  locale,
  onPress,
}: {
  rows: readonly CategorySplitRow[];
  currency: CurrencyCode;
  locale: AppLocale;
  onPress: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {rows.map((row) => (
        // Switching expense/income swaps the whole list; the rows fade rather than snap.
        <Animated.View key={row.id} layout={reflowing} entering={appearing} exiting={leaving}>
          <ListRow
            title={row.name}
            subtitle={`${row.delta === null ? t('stats.newLabel') : formatSignedPercent(row.delta)} · ${t('stats.ofTotal', { pct: row.share })}`}
            leading={<IconBox name={row.icon} colour={row.colour} />}
            onPress={() => onPress(row.id)}
            trailing={<AmountText minor={row.amount} currency={currency} locale={locale} />}
          />
        </Animated.View>
      ))}
    </>
  );
}
