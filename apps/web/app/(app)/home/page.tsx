import type { BudgetAdvice, BudgetView, CurrencyCode, GoalView } from '@saldo/core';
import { endLabels, goalPace, goalTone } from '@saldo/core';
import {
  type AppLocale,
  budgetCardStatusText,
  formatDayMonth,
  formatMoney,
  type GoalTextDeps,
  goalCardStatusText,
  goalEnds,
  goalLabel,
  goalMeta,
  goalOf,
  goalSentence,
  goalStatus,
  plural,
  richText,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { type HomeRow, homeView } from '../../../src/features/home/homeView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { Band, BandFigure, BandFigures } from '../../../src/ui/Band';
import { Columns } from '../../../src/ui/Columns';
import { EmptyState } from '../../../src/ui/EmptyState';
import { IconBox } from '../../../src/ui/IconBox';
import { ListRow } from '../../../src/ui/ListRow';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { Section } from '../../../src/ui/Section';
import { TargetRing } from '../../../src/ui/TargetRing';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
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
  /**
   * The figures as one sentence for a screen reader — the phone's `accessibilityLabel`. The drawn
   * figures are hidden from it; the sentence under them is not, since it says what to do.
   */
  label: string;
}

/**
 * The one item a target card lifts into view (§5.13): the figure that fills the bar, the bar with
 * its pace, and a sentence that says what to do. The phone's `FeaturedTarget`, in DOM.
 */
function Featured(props: FeaturedProps) {
  const labels = endLabels(props.pace);
  return (
    <div className={styles.featured}>
      <VisuallyHidden>{props.label}</VisuallyHidden>
      <div className={styles.featuredHead} aria-hidden="true">
        <IconBox name={props.icon} colorIndex={props.colorIndex} />
        <span className={styles.featuredName}>{props.name}</span>
        <span className={styles.featuredMeta}>{props.meta}</span>
      </div>
      <div className={styles.featuredAmount} aria-hidden="true">
        <AmountText
          minor={props.amount}
          currency={props.currency}
          locale={props.locale}
          size="title"
        />
      </div>
      <span className={styles.featuredOf} aria-hidden="true">
        {props.of}
      </span>
      <div className={styles.featuredBar} aria-hidden="true">
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
      badgeLabel={t('recurrence.recurringRow')}
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
  const budgetLabel = (item: BudgetView) =>
    t('targets.itemLabel', {
      name: item.budget.name,
      amount: money(item.spent),
      limit: money(item.limit),
      status: budgetStatus(item),
    });
  const budgetRow = (item: BudgetView) => (
    <ListRow
      key={item.budget.id}
      label={budgetLabel(item)}
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

  const budgetStatusLine = budgetCardStatusText(
    view.budgets.items.length,
    view.budgets.status,
    t,
    locale,
  );
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
  const goalRow = (item: GoalView) => (
    <ListRow
      key={item.account.id}
      label={goalLabel(item, goalDeps)}
      href={`/accounts?g=${item.account.id}`}
      icon={item.account.icon as IconName}
      colorIndex={item.account.colorIndex}
      title={item.account.name}
      subtitle={goalMeta(item, goalDeps)}
      trailing={
        <>
          <span className={styles.rowStatus}>
            <span className={styles.rowPercent}>{percent(item.progress.ratio)}</span>
            <span className={styles.rowStatusMeta}>{goalStatus(item, goalDeps)}</span>
          </span>
          <TargetRing
            size={ROW_RING}
            ratio={item.progress.ratio}
            pace={goalPace(item.progress)}
            tone={goalWebTone(item)}
          />
        </>
      }
    />
  );

  const goalStatusLine = goalCardStatusText(view.goals.items.length, view.goals.status, t, locale);
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
                // The header already says «Nessun budget», as on the phone: the body says what one is.
                <p className={styles.emptyNote}>{t('budgets.emptyBody')}</p>
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
                      label={budgetLabel(featuredBudget)}
                    />
                  )}
                  {budgetEvents.map(budgetRow)}
                  {budgetRest.map(budgetRow)}
                </>
              )}
            </Section>

            <Section title={t('goals.title')} trailing={goalStatusLine}>
              {view.goals.items.length === 0 ? (
                <p className={styles.emptyNote}>{t('goals.emptyBody')}</p>
              ) : (
                <>
                  {featuredGoal === undefined ? null : (
                    <Featured
                      icon={featuredGoal.account.icon as IconName}
                      colorIndex={featuredGoal.account.colorIndex}
                      name={featuredGoal.account.name}
                      meta={goalMeta(featuredGoal, goalDeps, true)}
                      amount={featuredGoal.progress.saved}
                      currency={currency}
                      locale={locale}
                      of={goalOf(featuredGoal, goalDeps)}
                      ratio={featuredGoal.progress.ratio}
                      pace={goalPace(featuredGoal.progress)}
                      tone={goalWebTone(featuredGoal)}
                      start={goalEnds(featuredGoal, goalDeps).start}
                      end={goalEnds(featuredGoal, goalDeps).end}
                      today={t('targets.today')}
                      sentence={goalSentenceNode(featuredGoal)}
                      label={goalLabel(featuredGoal, goalDeps)}
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
