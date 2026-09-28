import type {
  BudgetAdvice,
  BudgetView,
  CurrencyCode,
  GoalAdvice,
  GoalView,
  LocalDate,
} from '@saldo/core';
import { parseLocalDate } from '@saldo/core';
import { type AppLocale, formatDayMonth, formatMoney, formatMonthYear, plural } from '@saldo/i18n';
import { categoryColors, type IconName } from '@saldo/ui';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { type HomeRow, homeView } from '../../../src/features/home/homeView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { Band, BandFigure, BandFigures } from '../../../src/ui/Band';
import { Columns } from '../../../src/ui/Columns';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { ListRow } from '../../../src/ui/ListRow';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { Section } from '../../../src/ui/Section';
import { TargetRing } from '../../../src/ui/TargetRing';
import styles from './home.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The ring beside a budget or a goal row: the phone's `targetRingSmall`. */
const ROW_RING = 28;
/** Wide enough for «oggi» in every locale, centred on the pace tick (the phone's `FeaturedTarget`). */
const TODAY_WIDTH = 64;

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

/**
 * Which labels sit under a featured bar (§5.13): an end steps aside when «oggi» would collide with
 * it, and without a pace there is no «oggi» at all. The phone's `endLabels`, thresholds included.
 */
function endLabels(pace: number | null): { start: boolean; today: boolean; end: boolean } {
  if (pace === null) return { start: true, today: false, end: true };
  return { start: pace > 0.18, today: true, end: pace < 0.78 };
}

/** As `ListRow` wraps it: an index past the end of the palette must still name a variable. */
function paletteIndex(colorIndex: number): number {
  return ((colorIndex % categoryColors.length) + categoryColors.length) % categoryColors.length;
}

interface FeaturedProps {
  icon: IconName;
  colorIndex: number;
  name: string;
  /** Short, beside the name: «52 € rimasti», «limite superato». */
  meta: string;
  /** What fills the bar: spent for a budget, saved for a goal. */
  amount: number;
  currency: CurrencyCode;
  locale: AppLocale;
  /** «di 420,00 € · 88%». */
  of: string;
  ratio: number;
  pace: number | null;
  tone: 'normal' | 'over' | 'done';
  start: string;
  end: string;
  today: string;
  sentence: ReactNode;
}

/**
 * The one item a target card lifts into view (§5.13): the figure that fills the bar, the bar with
 * its pace, and a sentence that says what to do. The phone's `FeaturedTarget`, in DOM.
 */
function Featured(props: FeaturedProps) {
  const labels = endLabels(props.pace);
  const index = paletteIndex(props.colorIndex);
  return (
    <div className={styles.featured}>
      <div className={styles.featuredHead}>
        <span
          className={styles.featuredIcon}
          style={{ background: `var(--category-${index}-tint)`, color: `var(--category-${index})` }}
        >
          <Icon name={props.icon} size={16} />
        </span>
        <span className={styles.featuredName}>{props.name}</span>
        <span className={styles.featuredMeta}>{props.meta}</span>
      </div>
      <div className={styles.featuredAmount}>
        <AmountText
          minor={props.amount}
          currency={props.currency}
          locale={props.locale}
          size="title"
        />
      </div>
      <span className={styles.featuredOf}>{props.of}</span>
      <div className={styles.featuredBar}>
        <ProgressBar thick ratio={props.ratio} pace={props.pace} tone={props.tone} />
      </div>
      <div className={styles.ends} aria-hidden="true">
        {labels.start ? <span className={styles.endStart}>{props.start}</span> : null}
        {labels.today && props.pace !== null ? (
          <span
            className={styles.endToday}
            style={{
              insetInlineStart: `${props.pace * 100}%`,
              inlineSize: `${TODAY_WIDTH}px`,
              marginInlineStart: `${-TODAY_WIDTH / 2}px`,
            }}
          >
            {props.today}
          </span>
        ) : null}
        {labels.end ? <span className={styles.endEnd}>{props.end}</span> : null}
      </div>
      <p className={styles.sentence}>{props.sentence}</p>
    </div>
  );
}

/**
 * Home on the web (§17.1.7): the band across the width, then the 7/5 pair. Every figure comes from
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
      title={row.title}
      subtitle={`${formatDayMonth(row.date, locale)} · ${row.subtitle}`}
      upcoming={upcoming}
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
  const budgetPace = (item: BudgetView) => (item.open ? item.pace : null);
  const budgetTone = (item: BudgetView): 'normal' | 'over' =>
    item.overPace || item.overLimit ? 'over' : 'normal';
  const budgetColour = (item: BudgetView) =>
    page.data.categories.find((category) => category.id === item.budget.categoryIds[0])
      ?.colorIndex ?? 9;
  const budgetMeta = (item: BudgetView) => {
    if (item.overLimit) return t('targets.overLimitMeta');
    if (item.open) return t('targets.left', { amount: money(item.limit - item.spent) });
    return t('targets.closedMeta');
  };
  const budgetStatus = (item: BudgetView) => {
    if (item.overLimit) {
      return t('targets.overLimitBy', { amount: money(item.spent - item.limit) });
    }
    if (item.overPace) {
      return t('targets.overPaceBy', {
        amount: money(Math.round(item.spent - item.limit * item.pace)),
      });
    }
    return t('targets.inLine');
  };
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
  const budgetRow = (item: BudgetView) => (
    <ListRow
      key={item.budget.id}
      icon={item.budget.icon as IconName}
      colorIndex={budgetColour(item)}
      title={item.budget.name}
      subtitle={budgetMeta(item)}
      trailing={
        <>
          <span className={styles.rowStatus}>
            <span className={styles.rowPercent}>{percent(item.ratio)}</span>
            <span className={styles.rowStatusMeta}>{budgetStatus(item)}</span>
          </span>
          <TargetRing
            size={ROW_RING}
            ratio={item.ratio}
            pace={budgetPace(item)}
            tone={budgetTone(item)}
          />
        </>
      }
    />
  );

  const budgetStatusLine =
    view.budgets.status.kind === 'overLimit'
      ? plural(t, locale, 'targets.overLimit', view.budgets.status.count)
      : view.budgets.status.kind === 'overPace'
        ? plural(t, locale, 'budgets.overPace', view.budgets.status.count)
        : t('budgets.withinLimits');
  const featuredBudget = view.budgets.items.find(
    (item) => item.budget.id === view.budgets.featuredId,
  );
  const budgetEvents = view.budgets.eventIds.flatMap((id) =>
    view.budgets.items.filter((item) => item.budget.id === id),
  );
  const budgetRest = view.budgets.items.filter(
    (item) =>
      item.budget.id !== view.budgets.featuredId && !view.budgets.eventIds.includes(item.budget.id),
  );

  // ---- Obiettivi (§5.14) ----------------------------------------------------------------------
  /** «15 ott» this year, «giugno 2027» after (the phone's `deadlineLabel`). */
  const deadlineLabel = (date: LocalDate) => {
    const parts = parseLocalDate(date);
    return parts.year === parseLocalDate(today).year
      ? formatDayMonth(date, locale)
      : formatMonthYear(parts, locale);
  };
  const goalPace = (item: GoalView) => {
    const { state, pace } = item.progress;
    return state === 'reached' || state === 'expired' ? null : pace;
  };
  const goalTone = (item: GoalView): 'normal' | 'over' | 'done' => {
    const { state } = item.progress;
    if (state === 'reached') return 'done';
    return state === 'expired' || state === 'behind' ? 'over' : 'normal';
  };
  const goalStatus = (item: GoalView) => {
    const { state, gap, missing } = item.progress;
    switch (state) {
      case 'reached':
        return t('goals.statusReached');
      case 'expired':
        return t('goals.statusExpired');
      case 'behind':
        return t('goals.statusBehind', { amount: money(-(gap ?? 0)) });
      case 'onTrack':
        return t('goals.statusAhead', { amount: money(gap ?? 0) });
      case 'open':
        return t('goals.statusMissing', { amount: money(missing) });
    }
  };
  /** Beside the name: short on the featured block, full on a row. */
  const goalMeta = (item: GoalView, short = false) => {
    const { state, reachedOn } = item.progress;
    const deadline = item.account.goalDeadline ?? null;
    if (state === 'reached') {
      return short || reachedOn === null
        ? t('goals.toClose')
        : t('goals.reachedOnMeta', { date: formatDayMonth(reachedOn, locale) });
    }
    if (state === 'expired' && deadline !== null) {
      return short
        ? t('goals.expiredMeta')
        : t('goals.expiredOnMeta', { date: formatDayMonth(deadline, locale) });
    }
    return deadline === null
      ? t('goals.noDeadline')
      : t('goals.by', { date: deadlineLabel(deadline) });
  };
  const goalSentence = (advice: GoalAdvice, item: GoalView): ReactNode => {
    switch (advice.kind) {
      case 'perPeriod':
        return (
          <>
            <Rich
              text={t(`goals.perPeriod_${settings.periodKind}`, {
                amount: money(advice.perPeriod),
              })}
            />{' '}
            <span className={styles.muted}>
              {t(advice.behind ? 'goals.stateBehind' : 'goals.stateAhead', {
                amount: money(advice.gap),
              })}
            </span>
          </>
        );
      case 'lastPeriod':
        return (
          <Rich
            text={plural(t, locale, 'goals.lastPeriod', advice.days, {
              amount: money(advice.missing),
            })}
          />
        );
      case 'noDeadline':
        return <Rich text={t('goals.missingSentence', { amount: money(advice.missing) })} />;
      case 'expired':
        return (
          <>
            <Rich
              text={t('goals.expiredSentence', {
                amount: money(advice.missing),
                date: formatDayMonth(item.account.goalDeadline ?? today, locale),
              })}
            />{' '}
            <span className={styles.muted}>{t('goals.expiredState')}</span>
          </>
        );
      case 'reached':
        return (
          <>
            <Rich text={t('goals.reachedSentence', { amount: money(advice.target) })} />{' '}
            <span className={styles.muted}>{t('goals.reachedState')}</span>
          </>
        );
    }
  };
  const goalRow = (item: GoalView) => (
    <ListRow
      key={item.account.id}
      href={`/accounts?g=${item.account.id}`}
      icon={item.account.icon as IconName}
      colorIndex={item.account.colorIndex}
      title={item.account.name}
      subtitle={goalMeta(item)}
      trailing={
        <>
          <span className={styles.rowStatus}>
            <span className={styles.rowPercent}>{percent(item.progress.ratio)}</span>
            <span className={styles.rowStatusMeta}>{goalStatus(item)}</span>
          </span>
          <TargetRing
            size={ROW_RING}
            ratio={item.progress.ratio}
            pace={goalPace(item)}
            tone={goalTone(item)}
          />
        </>
      }
    />
  );

  const goalParts = [
    view.goals.status.expired > 0
      ? plural(t, locale, 'goals.expired', view.goals.status.expired)
      : null,
    view.goals.status.behind > 0
      ? plural(t, locale, 'goals.behind', view.goals.status.behind)
      : null,
    view.goals.status.reached > 0
      ? plural(t, locale, 'goals.reached', view.goals.status.reached)
      : null,
  ].filter((part): part is string => part !== null);
  const goalStatusLine =
    goalParts.length === 0 ? t('goals.onTime') : goalParts.slice(0, 2).join(' · ');
  const featuredGoal = view.goals.items.find((item) => item.account.id === view.goals.featuredId);
  const goalEvents = view.goals.eventIds.flatMap((id) =>
    view.goals.items.filter((item) => item.account.id === id),
  );
  const goalRest = view.goals.items.filter(
    (item) =>
      item.account.id !== view.goals.featuredId && !view.goals.eventIds.includes(item.account.id),
  );

  return (
    <div className={styles.page}>
      <Band>
        <PeriodHeader
          period={period}
          def={def}
          today={today}
          locale={locale}
          path="/home"
          strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
        />
        <BandFigures>
          <BandFigure label={period.isCurrent ? t('home.remaining') : t('home.leftover')}>
            <AmountText
              minor={view.summary.remaining}
              currency={currency}
              locale={locale}
              size="hero"
            />
          </BandFigure>
          <BandFigure label={t('home.income')}>
            <AmountText
              minor={view.summary.income}
              currency={currency}
              locale={locale}
              size="title"
            />
          </BandFigure>
          <BandFigure label={t('home.expenses')}>
            <AmountText
              minor={view.summary.spent}
              currency={currency}
              locale={locale}
              size="title"
            />
          </BandFigure>
        </BandFigures>
        <ProgressBar
          ratio={view.summary.ratio}
          pace={period.isCurrent ? view.summary.pace : null}
          tone={view.summary.overPace ? 'over' : 'normal'}
        />
        {/* `/onboarding` arrives in 0.3e: until then the page renders on the defaults (§17.1.2). */}
        {page.onboarded ? null : <p className={styles.notice}>{t('web.shell.finishOnPhone')}</p>}
      </Band>

      <Columns
        lead={
          <>
            {/* The phone hides «In arrivo» at zero, and counts them all past the five shown. */}
            {view.upcoming.count === 0 ? null : (
              <Section
                title={t('home.upcoming')}
                trailing={
                  <Link className={styles.seeAll} href="/transactions">
                    {plural(t, locale, 'home.upcomingCount', view.upcoming.count)}
                  </Link>
                }
              >
                {view.upcoming.rows.map((row) => txRow(row, true))}
              </Section>
            )}

            <Section
              title={t('home.recent')}
              trailing={
                <Link className={styles.seeAll} href="/transactions">
                  {t('home.allTransactions')}
                </Link>
              }
            >
              {view.recent.length === 0 ? (
                <EmptyState title={t('transactions.empty')} body={t('web.shell.comingIn0_3e')} />
              ) : (
                view.recent.map((row) => txRow(row, false))
              )}
            </Section>
          </>
        }
        trail={
          <>
            <Section title={t('home.budget')} trailing={budgetStatusLine}>
              {view.budgets.items.length === 0 ? (
                <EmptyState title={t('budgets.empty')} body={t('budgets.emptyBody')} />
              ) : (
                <>
                  {featuredBudget === undefined || view.budgets.advice === null ? null : (
                    <Featured
                      icon={featuredBudget.budget.icon as IconName}
                      colorIndex={budgetColour(featuredBudget)}
                      name={featuredBudget.budget.name}
                      meta={budgetMeta(featuredBudget)}
                      amount={featuredBudget.spent}
                      currency={currency}
                      locale={locale}
                      of={t('targets.ofLimit', {
                        amount: money(featuredBudget.limit),
                        percent: percent(featuredBudget.ratio),
                      })}
                      ratio={featuredBudget.ratio}
                      pace={budgetPace(featuredBudget)}
                      tone={budgetTone(featuredBudget)}
                      start={formatDayMonth(featuredBudget.range.start, locale)}
                      end={formatDayMonth(featuredBudget.range.end, locale)}
                      today={t('targets.today')}
                      sentence={budgetSentence(view.budgets.advice, featuredBudget)}
                    />
                  )}
                  {budgetEvents.map(budgetRow)}
                  {budgetRest.map(budgetRow)}
                </>
              )}
            </Section>

            <Section title={t('goals.title')} trailing={goalStatusLine}>
              {view.goals.items.length === 0 ? (
                <EmptyState title={t('goals.empty')} body={t('goals.emptyBody')} />
              ) : (
                <>
                  {featuredGoal === undefined || view.goals.advice === null ? null : (
                    <Featured
                      icon={featuredGoal.account.icon as IconName}
                      colorIndex={featuredGoal.account.colorIndex}
                      name={featuredGoal.account.name}
                      meta={goalMeta(featuredGoal, true)}
                      amount={featuredGoal.progress.saved}
                      currency={currency}
                      locale={locale}
                      of={t('targets.ofLimit', {
                        amount: money(featuredGoal.progress.target),
                        percent: percent(featuredGoal.progress.ratio),
                      })}
                      ratio={featuredGoal.progress.ratio}
                      pace={goalPace(featuredGoal)}
                      tone={goalTone(featuredGoal)}
                      start={deadlineLabel(featuredGoal.account.goalStartDate ?? today)}
                      end={
                        featuredGoal.account.goalDeadline === null ||
                        featuredGoal.account.goalDeadline === undefined
                          ? ''
                          : deadlineLabel(featuredGoal.account.goalDeadline)
                      }
                      today={t('targets.today')}
                      sentence={goalSentence(view.goals.advice, featuredGoal)}
                    />
                  )}
                  {goalEvents.map(goalRow)}
                  {goalRest.map(goalRow)}
                </>
              )}
            </Section>
          </>
        }
      />
    </div>
  );
}
