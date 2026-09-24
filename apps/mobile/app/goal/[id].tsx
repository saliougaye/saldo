import { formatLongDate } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { NotFoundScreen } from '../../src/components/NotFoundScreen';
import { Screen } from '../../src/components/Screen';
import { HeaderIconButton, ScreenHeader } from '../../src/components/ScreenHeader';
import { SectionLabel } from '../../src/components/SectionLabel';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { closeGoal } from '../../src/db/goalService';
import { useCategories } from '../../src/db/hooks';
import { GoalCard } from '../../src/features/goals/GoalCard';
import { GoalCloseSheet } from '../../src/features/goals/GoalCloseSheet';
import { goalExpenseParams, goalTransferParams } from '../../src/features/goals/goalLinks';
import { useGoalText } from '../../src/features/goals/useGoalText';
import { useGoalViews } from '../../src/features/goals/useGoalViews';
import { useRestoreGoal } from '../../src/features/goals/useRestoreGoal';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { FeaturedTarget } from '../../src/features/targets/FeaturedTarget';
import { transactionRow } from '../../src/features/transactions/transactionRow';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.36. */
export default function GoalDetail() {
  const theme = useTheme();
  const router = useRouter();
  const toast = useToast();
  const repos = useRepositories();
  const categories = useCategories();
  const { today } = usePeriod();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { views, accounts, rows, loaded } = useGoalViews();
  const text = useGoalText();
  const { t } = text;
  const [closing, setClosing] = useState(false);
  const restore = useRestoreGoal();

  const view = views.find((candidate) => candidate.account.id === id);
  const account = accounts.find((candidate) => candidate.id === id);
  const movements = useMemo(
    () => rows.filter((tx) => tx.accountId === id || tx.toAccountId === id).slice(0, 30),
    [rows, id],
  );

  if (!loaded) return <Screen>{null}</Screen>;
  if (account === undefined || account.type !== 'pocket') return <NotFoundScreen />;

  // A closed goal is history: the only thing left is to reopen it, empty (§5.14).
  if (view === undefined) {
    return (
      <Screen>
        <ScreenHeader title={account.name} />
        <PrimaryButton label={t('common.restore')} onPress={() => restore(account.id)} />
      </Screen>
    );
  }

  const parent = view.parent;
  const balance = view.progress.saved;
  const finish = () => {
    closeGoal(db, repos, account.id, today, new Date().toISOString());
    setClosing(false);
    toast.show(t('goals.closed'));
    router.back();
  };

  return (
    <Screen>
      <ScreenHeader
        title={account.name}
        trailing={
          <HeaderIconButton
            icon="pencil"
            label={t('goals.editGoal')}
            onPress={() => router.push({ pathname: '/goal/edit/[id]', params: { id: account.id } })}
          />
        }
      />
      <GoalCard reached={view.progress.state === 'reached'}>
        <FeaturedTarget
          icon={account.icon as IconName}
          colour={theme.categoryColor(account.colorIndex)}
          name={account.name}
          meta={text.meta(view, true)}
          amount={balance}
          currency={text.currency}
          locale={text.locale}
          of={text.of(view)}
          ratio={view.progress.ratio}
          pace={text.pace(view)}
          tone={text.tone(view)}
          start={text.ends(view).start}
          end={text.ends(view).end}
          sentence={text.sentence(view)}
          accessibilityLabel={text.label(view)}
        />
      </GoalCard>

      {parent === undefined ? null : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={t('goals.setAside')}
              onPress={() =>
                router.push({
                  pathname: '/transaction/new',
                  params: goalTransferParams(parent.id, account.id, account.name),
                })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              label={t('goals.withdraw')}
              onPress={() =>
                router.push({
                  pathname: '/transaction/new',
                  params: goalTransferParams(account.id, parent.id, account.name),
                })
              }
            />
          </View>
        </View>
      )}

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('goals.parent')}
            trailing={<Text color="textMuted">{parent?.name ?? '—'}</Text>}
          />
          <ListRow
            title={t('goals.deadline')}
            trailing={
              <Text color="textMuted">
                {account.goalDeadline == null
                  ? t('goals.deadlineNone')
                  : formatLongDate(account.goalDeadline, text.locale)}
              </Text>
            }
          />
          <ListRow
            title={t('goals.createdOn')}
            trailing={
              <Text color="textMuted">
                {formatLongDate(account.goalStartDate ?? today, text.locale)}
              </Text>
            }
          />
        </View>
      </Card>

      <SectionLabel>{t('goals.movements')}</SectionLabel>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {movements.length === 0 ? (
            <Text color="textMuted" style={{ paddingVertical: 12 }}>
              {t('goals.noMovements')}
            </Text>
          ) : (
            movements.map((tx) => {
              const row = transactionRow(tx, {
                category: (categoryId) => categories.find((category) => category.id === categoryId),
                accountName: (accountId) =>
                  accounts.find((candidate) => candidate.id === accountId)?.name ?? '',
                kindLabel: (kind) => t(`kinds.${kind}`),
                viewpointAccountId: account.id,
              });
              return (
                <ListRow
                  key={tx.id}
                  title={row.title}
                  subtitle={row.subtitle}
                  leading={<IconBox name={row.icon} colour={theme.categoryColor(row.colorIndex)} />}
                  trailing={
                    <AmountText
                      plain
                      align="end"
                      minor={row.amount.minor}
                      currency={text.currency}
                      locale={text.locale}
                      signDisplay={row.amount.signDisplay}
                    />
                  }
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                />
              );
            })
          )}
        </View>
      </Card>

      <SecondaryButton label={t('goals.close')} onPress={() => setClosing(true)} />

      <GoalCloseSheet
        visible={closing}
        onClose={() => setClosing(false)}
        reached={view.progress.state === 'reached'}
        balanceLabel={balance > 0 ? text.money(balance) : null}
        parentName={parent?.name ?? ''}
        onRecordExpense={() => {
          setClosing(false);
          router.push({
            pathname: '/transaction/new',
            params: goalExpenseParams(account.id, balance, account.name),
          });
        }}
        onReturn={finish}
      />
    </Screen>
  );
}
