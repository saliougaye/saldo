import type { BudgetAdvice, BudgetView, GoalView } from '@saldo/core';
import { endLabels, goalPace, goalTone, pocketParentCandidates } from '@saldo/core';
import {
  budgetCardStatusText,
  formatDayMonth,
  formatMoney,
  type GoalTextDeps,
  goalCardStatusText,
  goalEnds,
  goalLabel,
  goalOf,
  goalSentence,
  plural,
  richText,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { Fragment, type ReactNode } from 'react';
import { NEW_GOAL_HREF } from '../../../src/features/accounts/goalLinks';
import { budgetRowFor } from '../../../src/features/budgets/budgetRow';
import { type HomeRow, homeView } from '../../../src/features/home/homeView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import {
  Card,
  CardAction,
  CardGrid,
  CardHead,
  CardLabel,
  CardNote,
  CardSentence,
} from '../../../src/ui/Card';
import { ChartFrame } from '../../../src/ui/charts/ChartFrame';
import { TrendChart } from '../../../src/ui/charts/TrendChart';
import { EmptyState } from '../../../src/ui/EmptyState';
import { HeroFigure } from '../../../src/ui/HeroBand';
import { Icon } from '../../../src/ui/Icon';
import { ListRow } from '../../../src/ui/ListRow';
import { PageHead } from '../../../src/ui/PageHead';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { Section } from '../../../src/ui/Section';
import { TargetRing } from '../../../src/ui/TargetRing';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
import styles from './home.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Segment {
  key: string;
  text: string;
  strong: boolean;
}

/** The catalogs' one piece of markup: `<b>` around the figure a target's sentence is about (§5.13). */
function segments(text: string): Segment[] {
  return text
    .split(/<b>|<\/b>/)
    .map((part, index) => ({ key: `${index}`, text: part, strong: index % 2 === 1 }));
}

/** What `<Trans>` does on the phone, for a server component with no i18next around it. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((segment) =>
        segment.strong ? (
          <b className={styles.strong} key={segment.key}>
            {segment.text}
          </b>
        ) : (
          <Fragment key={segment.key}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Wide enough for «oggi» in every locale, centred on the pace tick. */
const TODAY_WIDTH = 64;

/** The bar of a target card and the three labels under it (§5.13), at 13px (D11). */
function TargetBar({
  ratio,
  pace,
  tone,
  start,
  end,
  today,
}: {
  ratio: number;
  pace: number | null;
  tone: 'normal' | 'over' | 'done';
  start: string;
  end: string;
  today: string;
}) {
  const labels = endLabels(pace);
  return (
    <div aria-hidden="true">
      <ProgressBar thick ratio={ratio} pace={pace} tone={tone} />
      <div className={styles.ends}>
        {labels.start ? <span className={styles.endStart}>{start}</span> : null}
        {labels.today && pace !== null ? (
          <span
            className={styles.endToday}
            style={{
              insetInlineStart: `${pace * 100}%`,
              inlineSize: `${TODAY_WIDTH}px`,
              marginInlineStart: `${-TODAY_WIDTH / 2}px`,
            }}
          >
            {today}
          </span>
        ) : null}
        {labels.end ? <span className={styles.endEnd}>{end}</span> : null}
      </div>
    </div>
  );
}

/**
 * Home on the web (§17.1.7, G2): the head with the trend, then Transazioni, Budget and Obiettivi. Every figure comes from
 * `homeView`, which is the same `@saldo/core` the phone calls — nothing is computed here.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, period, settings } = page;
  const view = homeView({
    data: page.data,
    today,
    def,
    period,
    kindLabel: (kind) => t(`kinds.${kind}`),
  });

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const percent = (ratio: number) => t('targets.percent', { value: Math.round(ratio * 100) });

  const txRow = (row: HomeRow, upcoming: boolean) => (
    <ListRow
      key={row.id}
      href={`/transactions?t=${row.id}`}
      icon={row.icon as IconName}
      colorIndex={row.colorIndex}
      badge={row.recurring ? 'repeat' : undefined}
      badgeLabel={t('recurrence.recurringRow')}
      title={row.title}
      subtitle={`${formatDayMonth(row.date, locale)} · ${row.subtitle}`}
      upcoming={upcoming}
      open
      trailing={
        <AmountText
          minor={row.amount.minor}
          currency={currency}
          locale={locale}
          sign={row.amount.signDisplay}
          muted={upcoming || row.amount.muted}
        />
      }
    />
  );

  // ---- Budget (§5.13) -------------------------------------------------------------------------
  const budgets = budgetRowFor({
    t,
    money,
    percent,
    categories: page.data.categories,
    styles,
    href: (item) => `/profile/budgets?b=${item.budget.id}`,
  });
  const budgetSentence = (advice: BudgetAdvice, item: BudgetView): ReactNode => {
    const end = formatDayMonth(item.range.end, locale);
    if (advice.kind === 'perDay') {
      return (
        <>
          <Rich text={t('targets.perDay', { amount: money(advice.perDay), end })} />{' '}
          <span className={styles.muted}>
            {t(advice.overPace ? 'targets.stateOverPace' : 'targets.stateUnderPace', {
              amount: money(advice.gap),
            })}
          </span>
        </>
      );
    }
    if (advice.kind === 'overLimit') {
      return (
        <>
          <Rich text={t('targets.overLimitAction', { amount: money(advice.overrun) })} />
          {item.open ? (
            <>
              {' '}
              <span className={styles.muted}>
                {t('targets.overLimitState', { name: item.budget.name, end })}
              </span>
            </>
          ) : null}
        </>
      );
    }
    return (
      <Rich
        text={t('targets.closed', {
          percent: t('targets.percent', { value: advice.percent }),
        })}
      />
    );
  };

  const budgetStatusLine = budgetCardStatusText(
    view.budgets.items.length,
    view.budgets.status,
    t,
    locale,
  );
  // ---- Obiettivi (§5.14) ----------------------------------------------------------------------
  // The strings are `@saldo/i18n`'s and the tone and pace `@saldo/core`'s: the phone's
  // `useGoalText` calls the same functions, so the two cannot drift apart.
  const goalDeps: GoalTextDeps = {
    t,
    locale,
    money,
    today,
    periodKind: settings.periodKind,
  };
  const goalWebTone = (item: GoalView): 'normal' | 'over' | 'done' => {
    const tone = goalTone(item.progress);
    return tone === 'attention' ? 'over' : tone === 'plain' ? 'normal' : 'done';
  };
  const goalSentenceNode = (item: GoalView): ReactNode => {
    const { action, state } = goalSentence(item, goalDeps);
    const bold = <Rich text={richText(action, t, locale)} />;
    if (state === null) return bold;
    return (
      <>
        {bold} <span className={styles.muted}>{state}</span>
      </>
    );
  };
  const goalStatusLine = goalCardStatusText(view.goals.items.length, view.goals.status, t, locale);
  const budgetCard = (item: BudgetView) => {
    const advice = view.budgets.adviceById[item.budget.id];
    return (
      <Card key={item.budget.id} href={`/profile/budgets?b=${item.budget.id}`}>
        <VisuallyHidden>{budgets.label(item)}</VisuallyHidden>
        <div aria-hidden="true">
          <CardHead
            leading={
              <TargetRing
                size={32}
                ratio={item.ratio}
                pace={budgets.pace(item)}
                tone={budgets.tone(item)}
                icon={item.budget.icon as IconName}
                colorIndex={budgets.colour(item)}
              />
            }
            name={item.budget.name}
            meta={percent(item.ratio)}
            attention={budgets.tone(item) === 'over'}
          />
        </div>
        <div aria-hidden="true">
          {/* D5: the figure is what is left; the line under it is what is spent of the limit. */}
          <AmountText
            minor={Math.max(0, item.limit - item.spent)}
            currency={currency}
            locale={locale}
            size="large"
          />
          <CardNote>
            {item.overLimit
              ? t('targets.overLimitBy', { amount: money(item.spent - item.limit) })
              : t('targets.leftDetail', { spent: money(item.spent), limit: money(item.limit) })}
          </CardNote>
        </div>
        <TargetBar
          ratio={item.ratio}
          pace={budgets.pace(item)}
          tone={budgets.tone(item)}
          start={formatDayMonth(item.range.start, locale)}
          end={formatDayMonth(item.range.end, locale)}
          today={t('targets.today')}
        />
        {advice === undefined ? null : <CardSentence>{budgetSentence(advice, item)}</CardSentence>}
      </Card>
    );
  };

  const goalCard = (item: GoalView) => (
    <Card key={item.account.id} href={`/accounts?g=${item.account.id}`}>
      <VisuallyHidden>{goalLabel(item, goalDeps)}</VisuallyHidden>
      <div aria-hidden="true">
        <CardHead
          leading={
            <TargetRing
              size={32}
              ratio={item.progress.ratio}
              pace={goalPace(item.progress)}
              tone={goalWebTone(item)}
              icon={item.account.icon as IconName}
              colorIndex={item.account.colorIndex}
            />
          }
          name={item.account.name}
          meta={percent(item.progress.ratio)}
          attention={goalWebTone(item) === 'over'}
        />
      </div>
      <div aria-hidden="true">
        <AmountText minor={item.progress.saved} currency={currency} locale={locale} size="large" />
        <CardNote>{goalOf(item, goalDeps)}</CardNote>
      </div>
      <TargetBar
        ratio={item.progress.ratio}
        pace={goalPace(item.progress)}
        tone={goalWebTone(item)}
        start={goalEnds(item, goalDeps).start}
        end={goalEnds(item, goalDeps).end}
        today={t('targets.today')}
      />
      <CardSentence>{goalSentenceNode(item)}</CardSentence>
    </Card>
  );

  const delta = view.trend.delta;

  return (
    <div className={styles.page}>
      <PageHead
        title={
          <PeriodHeader
            period={period}
            def={def}
            today={today}
            locale={locale}
            path="/home"
            status={
              period.isCurrent
                ? t('home.dayOf', { elapsed: period.elapsed, length: period.length })
                : t('home.closedCycle')
            }
            strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
          />
        }
        hero={
          <HeroFigure label={period.isCurrent ? t('home.remaining') : t('home.leftover')}>
            <AmountText
              minor={view.summary.remaining}
              currency={currency}
              locale={locale}
              size="hero"
            />
          </HeroFigure>
        }
        stats={
          <>
            <HeroFigure label={t('home.income')}>
              <AmountText
                minor={view.summary.income}
                currency={currency}
                locale={locale}
                size="headline"
                positive
              />
            </HeroFigure>
            <HeroFigure label={t('home.expenses')}>
              <AmountText
                minor={view.summary.spent}
                currency={currency}
                locale={locale}
                size="headline"
              />
            </HeroFigure>
          </>
        }
        aside={
          <ChartFrame
            title={t('stats.cycleTrend')}
            value={
              <AmountText
                minor={view.summary.spent}
                currency={currency}
                locale={locale}
                size="footnote"
              />
            }
            foot={
              <>
                <span>{t('home.dayOf', { elapsed: period.elapsed, length: period.length })}</span>
                {delta === null ? null : (
                  <span className={styles.vsUsual}>
                    {t(delta >= 0 ? 'home.vsUsualAbove' : 'home.vsUsualBelow', {
                      amount: money(Math.abs(delta)),
                    })}
                  </span>
                )}
              </>
            }
          >
            <TrendChart current={view.trend.current} usual={view.trend.usual} height={96} />
          </ChartFrame>
        }
      />

      <Section
        open
        title={t('tabs.transactions')}
        trailing={
          view.upcoming.count === 0
            ? undefined
            : plural(t, locale, 'home.upcomingSummary', view.upcoming.count, {
                amount: money(view.upcoming.total),
              })
        }
        more={
          <Link className={styles.more} href="/transactions">
            <span>{t('home.allTransactions')}</span>
            <Icon name="chevR" size={16} />
          </Link>
        }
      >
        <div className={styles.txCols}>
          <div>
            <span className={styles.groupLabel}>{t('home.latest')}</span>
            {view.recent.length === 0 ? (
              <EmptyState title={t('transactions.empty')} body={t('transactions.emptyBody')} />
            ) : (
              view.recent.map((row) => txRow(row, false))
            )}
          </div>
          {view.upcoming.count === 0 ? null : (
            <div>
              <span className={styles.groupLabel}>
                {t('home.upcomingUntil', { date: formatDayMonth(period.range.end, locale) })}
              </span>
              {view.upcoming.rows.map((row) => txRow(row, true))}
            </div>
          )}
        </div>
      </Section>

      <Section
        open
        title={t('home.budget')}
        trailing={budgetStatusLine}
        attention={view.budgets.items.length > 0 && view.budgets.status.kind !== 'withinLimits'}
      >
        <CardGrid>
          {view.budgets.items.map(budgetCard)}
          {/* D6: the last card, and the way to a new budget. */}
          <Card ghost href="/profile/budgets?new">
            <CardLabel>{t('home.unbudgeted')}</CardLabel>
            <AmountText
              minor={view.budgets.unbudgeted}
              currency={currency}
              locale={locale}
              size="headline"
            />
            <CardLabel>
              {view.budgets.items.length === 0 ? t('budgets.emptyBody') : t('home.unbudgetedNote')}
            </CardLabel>
            <CardAction>{t('targets.createBudget')}</CardAction>
          </Card>
        </CardGrid>
      </Section>

      <Section open title={t('goals.title')} trailing={goalStatusLine}>
        <CardGrid>
          {view.goals.items.map(goalCard)}
          {view.goals.items.length > 0 ||
          pocketParentCandidates(page.data.accounts).length === 0 ? null : (
            <Card ghost href={NEW_GOAL_HREF}>
              <CardLabel>{goalStatusLine}</CardLabel>
              <p className={styles.ghostBody}>{t('goals.emptyBody')}</p>
              <CardAction>{t('goals.create')}</CardAction>
            </Card>
          )}
        </CardGrid>
        {view.goals.items.length === 0 &&
        pocketParentCandidates(page.data.accounts).length === 0 ? (
          <p className={styles.emptyNote}>{t('goals.emptyBody')}</p>
        ) : null}
      </Section>
    </div>
  );
}
