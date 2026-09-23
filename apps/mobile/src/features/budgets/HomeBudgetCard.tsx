import {
  budgetAdvice,
  type BudgetTargetInput,
  budgetCardStatus,
  budgetEventIds,
  featuredTarget,
  rankBudget,
} from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { CardHeader } from '../../components/CardHeader';
import { ListRow } from '../../components/ListRow';
import { TargetRing, type TargetTone } from '../../components/TargetRing';
import { useDatabase } from '../../db/DatabaseProvider';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { FeaturedTarget } from '../targets/FeaturedTarget';
import { SeeAllRow } from '../targets/SeeAllRow';
import type { BudgetView } from './useBudgetProgress';

/** Device-local (never synced): the budget featured last, for the hysteresis of §5.13. */
export const FEATURED_BUDGET_KEY = 'home.featuredBudget';

const BOLD = { b: <Text weight="medium" /> };

/**
 * §5.13, D25: one budget featured with what to do about it, the budgets over their limit as rows,
 * everything else as rings behind «Tutti i budget». Follows the period selected on Home.
 */
export function HomeBudgetCard({ views }: { views: readonly BudgetView[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const { kv } = useDatabase();
  const currency = settings?.currency ?? 'EUR';

  const inputs = useMemo<BudgetTargetInput[]>(
    () => views.map((view) => ({ id: view.budget.id, progress: view, pace: view.pace })),
    [views],
  );
  const [previous, setPrevious] = useState(() => kv.get(FEATURED_BUDGET_KEY));
  const featuredId = useMemo(
    () => featuredTarget(inputs.map(rankBudget), previous),
    [inputs, previous],
  );
  useEffect(() => {
    if (featuredId === null || featuredId === previous) return;
    kv.set(FEATURED_BUDGET_KEY, featuredId);
    setPrevious(featuredId);
  }, [featuredId, previous, kv]);

  const allBudgets = () => router.push('/budgets');

  // Without budgets the card stays: it is the way into /budgets and the wizard behind it (§5.8).
  if (views.length === 0) {
    return (
      <Card>
        <CardHeader title={t('home.budget')} status={t('budgets.empty')} />
        <SeeAllRow label={t('targets.createBudget')} onPress={allBudgets} />
      </Card>
    );
  }

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const colourOf = (view: BudgetView) =>
    theme.categoryColor(
      categories.find((category) => category.id === view.budget.categoryIds[0])?.colorIndex ?? 9,
    );
  const toneOf = (view: BudgetView): TargetTone =>
    view.overPace || view.overLimit ? 'attention' : 'plain';
  const paceOf = (view: BudgetView) => (view.open ? view.pace : null);
  const statusOf = (view: BudgetView) => {
    if (view.overLimit) return t('targets.overLimitBy', { amount: money(view.spent - view.limit) });
    if (view.overPace) {
      return t('targets.overPaceBy', {
        amount: money(Math.round(view.spent - view.limit * view.pace)),
      });
    }
    return t('targets.inLine');
  };
  const percentOf = (view: BudgetView) =>
    t('targets.percent', { value: Math.round(view.ratio * 100) });
  const openBudget = (id: string) => router.push({ pathname: '/budgets', params: { open: id } });

  const status = budgetCardStatus(inputs);
  const statusText =
    status.kind === 'overLimit'
      ? t('targets.overLimit', { count: status.count })
      : status.kind === 'overPace'
        ? t('budgets.overPace', { count: status.count })
        : t('budgets.withinLimits');

  const featured = views.find((view) => view.budget.id === featuredId);
  const eventIds = budgetEventIds(inputs, featuredId);
  const events = eventIds.flatMap((id) => views.filter((view) => view.budget.id === id));
  const rest = views.filter(
    (view) => view.budget.id !== featuredId && !eventIds.includes(view.budget.id),
  );

  return (
    <Card>
      <CardHeader
        title={t('home.budget')}
        status={statusText}
        statusTone={status.kind === 'withinLimits' ? 'muted' : 'accent'}
      />

      {featured === undefined ? null : (
        <FeaturedTarget
          icon={featured.budget.icon as IconName}
          colour={colourOf(featured)}
          name={featured.budget.name}
          meta={
            featured.overLimit
              ? t('targets.overLimitMeta')
              : featured.open
                ? t('targets.left', { amount: money(featured.limit - featured.spent) })
                : t('targets.closedMeta')
          }
          amount={featured.spent}
          currency={currency}
          locale={locale}
          of={t('targets.ofLimit', { amount: money(featured.limit), percent: percentOf(featured) })}
          ratio={featured.ratio}
          pace={paceOf(featured)}
          tone={toneOf(featured)}
          start={formatDayMonth(featured.range.start, locale)}
          end={formatDayMonth(featured.range.end, locale)}
          sentence={<BudgetSentence view={featured} money={money} />}
          accessibilityLabel={t('targets.itemLabel', {
            name: featured.budget.name,
            amount: money(featured.spent),
            limit: money(featured.limit),
            status: statusOf(featured),
          })}
          onPress={() => openBudget(featured.budget.id)}
        />
      )}

      {events.length === 0 ? null : (
        <View style={{ borderTopWidth: 1, borderTopColor: theme.palette.border, paddingTop: 4 }}>
          {events.map((view) => (
            <ListRow
              key={view.budget.id}
              title={view.budget.name}
              subtitle={t('targets.overLimitMeta')}
              leading={
                <TargetRing
                  size={theme.layout.targetRing}
                  ratio={view.ratio}
                  pace={paceOf(view)}
                  tone={toneOf(view)}
                  icon={view.budget.icon as IconName}
                  colour={colourOf(view)}
                />
              }
              trailing={
                <View style={{ alignItems: 'flex-end' }}>
                  <Text tabular>{percentOf(view)}</Text>
                  <Text size="footnote" color="accent" tabular>
                    {statusOf(view)}
                  </Text>
                </View>
              }
              onPress={() => openBudget(view.budget.id)}
            />
          ))}
        </View>
      )}

      <SeeAllRow
        label={t('targets.allBudgets')}
        count={views.length}
        rings={rest.map((view) => ({
          id: view.budget.id,
          ratio: view.ratio,
          pace: paceOf(view),
          tone: toneOf(view),
          icon: view.budget.icon as IconName,
          colour: colourOf(view),
        }))}
        onPress={allBudgets}
      />
    </Card>
  );
}

/** Action (with its amount in bold), then state, muted (§5.13). */
function BudgetSentence({
  view,
  money,
}: {
  view: BudgetView;
  money: (minor: number) => string;
}) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const end = formatDayMonth(view.range.end, locale);
  // `daysLeft` excludes today; the advice spends today too.
  const advice = budgetAdvice(view, view.pace, view.open, view.daysLeft + 1);

  if (advice.kind === 'perDay') {
    return (
      <>
        <Trans
          t={t}
          i18nKey="targets.perDay"
          values={{ amount: money(advice.perDay), end }}
          components={BOLD}
        />{' '}
        <Text color="textMuted">
          {t(advice.overPace ? 'targets.stateOverPace' : 'targets.stateUnderPace', {
            amount: money(advice.gap),
          })}
        </Text>
      </>
    );
  }
  if (advice.kind === 'overLimit') {
    return (
      <>
        <Trans
          t={t}
          i18nKey="targets.overLimitAction"
          values={{ amount: money(advice.overrun) }}
          components={BOLD}
        />
        {view.open ? (
          <>
            {' '}
            <Text color="textMuted">
              {t('targets.overLimitState', { name: view.budget.name, end })}
            </Text>
          </>
        ) : null}
      </>
    );
  }
  return (
    <Trans
      t={t}
      i18nKey="targets.closed"
      values={{ percent: t('targets.percent', { value: advice.percent }) }}
      components={BOLD}
    />
  );
}
