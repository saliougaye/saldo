import { formatLongDate } from '@saldo/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useCategories, useSettings, useTags } from '../../src/db/hooks';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.6. Attachments arrive in phase 08. */
export default function TransactionDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const categories = useCategories();
  const accounts = useAccounts();
  const tags = useTags();

  const transaction = id === undefined ? null : repos.transactions.byId(id);
  if (transaction === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('transactions.empty')}</Text>
      </Screen>
    );
  }

  const currency = settings?.currency ?? 'EUR';
  const category = categories.find((row) => row.id === transaction.categoryId);
  const account = accounts.find((row) => row.id === transaction.accountId);
  const toAccount = accounts.find((row) => row.id === transaction.toAccountId);
  const rowTags = tags.filter((tag) => transaction.tagIds.includes(tag.id));

  return (
    <Screen
      footer={
        <PrimaryButton
          label={t('common.edit')}
          onPress={() =>
            router.push({ pathname: '/transaction/edit/[id]', params: { id: transaction.id } })
          }
        />
      }
    >
      <BackButton />
      <AmountText
        minor={transaction.kind === 'income' ? transaction.amount : -transaction.amount}
        currency={currency}
        locale={locale}
        size="hero"
        weight="semibold"
        tracking="tightest"
        signDisplay={transaction.kind === 'income' ? 'always' : 'negative'}
      />
      <Text size="headline" color="textMuted">
        {transaction.description.length > 0 ? transaction.description : (category?.name ?? '—')}
      </Text>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding }}>
          {transaction.kind === 'transfer' ? null : (
            <ListRow
              title={t('transactions.detailCategory')}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.categoryColor(category?.colorIndex ?? 9),
                    }}
                  />
                  <Text color="textMuted">{category?.name ?? '—'}</Text>
                </View>
              }
            />
          )}
          <ListRow
            title={t('transactions.detailAccount')}
            trailing={
              <Text color="textMuted">
                {transaction.kind === 'transfer'
                  ? `${account?.name ?? '—'} → ${toAccount?.name ?? '—'}`
                  : (account?.name ?? '—')}
              </Text>
            }
          />
          <ListRow
            title={t('transactions.detailDate')}
            trailing={<Text color="textMuted">{formatLongDate(transaction.date, locale)}</Text>}
          />
          <ListRow
            title={t('transactions.detailNote')}
            trailing={
              <Text color="textMuted" numberOfLines={1} style={{ maxWidth: 200 }}>
                {transaction.note ??
                  (transaction.recurrenceId === null
                    ? t('transactions.manual')
                    : t('transactions.recurringEveryMonth'))}
              </Text>
            }
          />
          {transaction.excludeFromTotals ? (
            <ListRow
              title={t('transactions.excludedFromTotals')}
              trailing={<Text color="textMuted">✓</Text>}
            />
          ) : null}
        </View>
      </Card>

      {rowTags.length === 0 ? null : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {rowTags.map((tag) => (
            <Chip key={tag.id} label={tag.name} />
          ))}
        </View>
      )}
    </Screen>
  );
}
