import { formatLongDate } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Chip } from '../../src/components/Chip';
import { IconBox } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import {
  useAccounts,
  useAttachments,
  useCategories,
  useSettings,
  useTags,
  useTransaction,
} from '../../src/db/hooks';
import { AttachmentTile } from '../../src/features/transactions/AttachmentTile';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.6: the receipt tile, 96×124 as in the design. */
const RECEIPT_WIDTH = 96;
const RECEIPT_HEIGHT = 124;

/**
 * §6.6. Dividers rather than a card: the rows are one continuous list of facts about a single
 * transaction, and boxing them made the screen read as four unrelated groups.
 */
export default function TransactionDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const categories = useCategories();
  const accounts = useAccounts();
  const tags = useTags();
  const attachments = useAttachments(id ?? '');

  const transaction = useTransaction(id ?? '');
  if (transaction === null) {
    return (
      <Screen>
        <BackButton />
        <Text color="textMuted">{t('transactions.empty')}</Text>
      </Screen>
    );
  }

  const currency = settings?.currency ?? 'EUR';
  const category = categories.find((row) => row.id === transaction.categoryId);
  const account = accounts.find((row) => row.id === transaction.accountId);
  const toAccount = accounts.find((row) => row.id === transaction.toAccountId);
  const rowTags = tags.filter((tag) => transaction.tagIds.includes(tag.id));

  const row = (label: string, value: ReactNode, first = false) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        minHeight: theme.layout.minHitTarget,
        paddingVertical: 13,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.palette.border,
      }}
    >
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{value}</View>
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <BackButton />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/transaction/edit/[id]', params: { id: transaction.id } })
          }
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: theme.layout.headerButton,
            paddingHorizontal: 12,
            borderRadius: theme.radii.chipSmall,
            backgroundColor: theme.palette.raised,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Icon name="pencil" size={14} color={theme.palette.text} />
          <Text size="footnote" weight="medium">
            {t('common.edit')}
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 10, paddingTop: 10 }}>
        <AmountText
          minor={transaction.kind === 'income' ? transaction.amount : -transaction.amount}
          currency={currency}
          locale={locale}
          size="hero"
          weight="semibold"
          tracking="tightest"
          signDisplay={transaction.kind === 'income' ? 'always' : 'negative'}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {category === undefined ? null : (
            <IconBox
              name={category.icon as IconName}
              colour={theme.categoryColor(category.colorIndex)}
              small
            />
          )}
          <Text size="headline" color="textMuted" numberOfLines={2} style={{ flex: 1 }}>
            {transaction.description.length > 0 ? transaction.description : (category?.name ?? '—')}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        {transaction.kind === 'transfer'
          ? row(
              t('transactions.detailAccount'),
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text>{account?.name ?? '—'}</Text>
                <Text color="textFaint">→</Text>
                <Text>{toAccount?.name ?? '—'}</Text>
              </View>,
              true,
            )
          : null}
        {transaction.kind === 'transfer'
          ? null
          : row(
              t('transactions.detailCategory'),
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: theme.categoryColor(category?.colorIndex ?? 9),
                  }}
                />
                <Text>{category?.name ?? '—'}</Text>
              </View>,
              true,
            )}
        {transaction.kind === 'transfer'
          ? null
          : row(t('transactions.detailAccount'), <Text>{account?.name ?? '—'}</Text>)}
        {row(
          t('transactions.detailDate'),
          <Text tabular>{formatLongDate(transaction.date, locale)}</Text>,
        )}
        {row(
          t('transactions.detailNote'),
          <Text style={{ textAlign: 'right' }}>
            {transaction.note ??
              (transaction.recurrenceId === null
                ? t('transactions.manual')
                : t('transactions.recurringEveryMonth'))}
          </Text>,
        )}
        {transaction.excludeFromTotals
          ? row(
              t('transactions.excludedFromTotals'),
              <Icon name="check" size={16} color={theme.palette.text} />,
            )
          : null}
      </View>

      {rowTags.length === 0 ? null : (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text size="footnote" color="textMuted">
            {t('transactions.tags')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {rowTags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                icon="tag"
                onPress={() => router.push({ pathname: '/tag/[id]', params: { id: tag.id } })}
              />
            ))}
          </View>
        </View>
      )}

      {attachments.length === 0 ? null : (
        <View style={{ gap: 10, marginTop: 12 }}>
          <Text size="footnote" color="textMuted">
            {t('transactions.detailAttachments')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {attachments.map((attachment) => (
                <AttachmentTile
                  key={attachment.id}
                  row={attachment}
                  width={RECEIPT_WIDTH}
                  height={RECEIPT_HEIGHT}
                  labelled
                  onPress={() =>
                    router.push({ pathname: '/attachment/[id]', params: { id: attachment.id } })
                  }
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </Screen>
  );
}
