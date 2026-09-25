import {
  type CurrencyCode,
  type DateRange,
  type LedgerTx,
  type LocalDate,
  tagTotals,
} from '@saldo/core';
import type { AppLocale } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../components/AmountText';
import { Card } from '../../components/Card';
import { ListRow } from '../../components/ListRow';
import { useTags } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { useHiddenMoney } from '../hidden/hiddenAmounts';

/** How many tags the card shows before handing over to the full list. */
const TOP_TAGS = 5;

export interface TagSpendCardProps {
  rows: readonly LedgerTx[];
  range: DateRange;
  today: LocalDate;
  currency: CurrencyCode;
  locale: AppLocale;
}

/**
 * "Tag" on Statistics: which trips, moves and refunds this cycle paid for, and what came back.
 *
 * A tag is the app's only non-cyclical dimension — "Vacanza Roma" is an event, not a month — and
 * until now the only way in was Profile → Tag, an admin screen. This card is the reading entry
 * point; tapping a row opens the tag view, which stays on **all** dates and says so.
 *
 * It is a ranking, never a split bar: a transaction can carry several tags or none, so the amounts
 * neither add up to the cycle's spend nor exclude each other (see `tagTotals`). The untagged
 * line is what keeps that honest.
 *
 * Income a tag carries sits under its spend, signed, and is never subtracted from it: the tag view
 * shows the same two figures (§5.10), and a card that netted them would disagree with it.
 */
export function TagSpendCard({ rows, range, today, currency, locale }: TagSpendCardProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const tags = useTags();

  const spending = useMemo(() => tagTotals(rows, range, today), [rows, range, today]);
  const top = spending.tags.slice(0, TOP_TAGS);
  const anyIncome = top.some((row) => row.income > 0);
  const nameOf = useMemo(() => new Map(tags.map((tag) => [tag.id, tag.name])), [tags]);

  return (
    <Card>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text weight="medium" tracking="tight">
          {t('stats.tags')}
        </Text>
        <Text size="caption" color="textFaint" numberOfLines={1}>
          {anyIncome ? t('stats.tagsFlows') : t('stats.expenses')}
        </Text>
      </View>

      {top.length === 0 ? (
        <Text color="textMuted" style={{ paddingVertical: 12 }}>
          {t('stats.tagsEmpty')}
        </Text>
      ) : (
        <View style={{ marginTop: 2 }}>
          {top.map((row) => (
            <ListRow
              key={row.tagId}
              title={nameOf.get(row.tagId) ?? row.tagId}
              subtitle={t('tags.uses', { count: row.count })}
              onPress={() => router.push({ pathname: '/tag/[id]', params: { id: row.tagId } })}
              trailing={
                <View style={{ alignItems: 'flex-end' }}>
                  {/* A tag that only brought money in has no spend worth a "0,00" above it. */}
                  {row.expense === 0 && row.income > 0 ? null : (
                    <AmountText
                      minor={row.expense}
                      currency={currency}
                      locale={locale}
                      align="end"
                    />
                  )}
                  {row.income === 0 ? null : (
                    <AmountText
                      minor={row.income}
                      currency={currency}
                      locale={locale}
                      align="end"
                      size="footnote"
                      color="positive"
                      signDisplay="always"
                    />
                  )}
                </View>
              }
              chevron
            />
          ))}
        </View>
      )}

      {spending.untaggedCount === 0 ? null : (
        <Text size="footnote" color="textMuted" style={{ marginTop: 8 }}>
          {t('stats.tagsUntagged', {
            count: spending.untaggedCount,
            amount: money(spending.untagged, currency, locale),
          })}
        </Text>
      )}
      {top.length < 2 ? null : (
        <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
          {t('stats.tagsOverlap')}
        </Text>
      )}

      {tags.length === 0 ? null : (
        <View style={{ marginTop: 4 }}>
          <ListRow
            title={t('stats.tagsAll')}
            onPress={() => router.push('/settings/tags')}
            chevron
          />
        </View>
      )}
    </Card>
  );
}
