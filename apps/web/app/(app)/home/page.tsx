import type { BudgetAdvice, BudgetView, GoalView } from '@saldo/core';
import { accountBalances, addDays, goalPace, goalTone, isPocket } from '@saldo/core';
import {
  budgetCardStatusText,
  formatDayMonth,
  formatMoney,
  type GoalTextDeps,
  goalCardStatusText,
  goalLabel,
  goalOf,
  goalStatus,
  plural,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { Fragment, type ReactNode } from 'react';
import { NEW_GOAL_HREF } from '../../../src/features/accounts/goalLinks';
import { budgetRowFor } from '../../../src/features/budgets/budgetRow';
import { budgetStatus } from '../../../src/features/budgets/budgetText';
import { gettingStarted } from '../../../src/features/home/gettingStarted';
import { HOME_ROWS, type HomeRow, homeView } from '../../../src/features/home/homeView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { TrendScrub } from '../../../src/ui/charts/TrendScrub';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { paletteIndex } from '../../../src/ui/IconBox';
import { NewTransactionLink } from '../../../src/ui/NewTransactionLink';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { TargetRing } from '../../../src/ui/TargetRing';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
import styles from './home.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** H6: the budget ring of the Home. */
const BUDGET_RING = 52;
/** H9: the goal ring of the Home. */
const GOAL_RING = 40;

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

/** A category colour as the CSS variable the root layout injects, or nothing for a row with none. */
function tint(colorIndex: number | null | undefined): string | undefined {
  return colorIndex === null || colorIndex === undefined
    ? undefined
    : `var(--category-${paletteIndex(colorIndex)})`;
}

/**
 * The Home (H4): one column, four blocks, in the order of the questions — how the period goes
 * (Summary), what you can still spend (Budget), what moved (Transactions), what you set aside
 * (Goals). Every figure comes from `homeView`, the same `@saldo/core` the phone calls.
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

  // W11: a new user starts here. The blocks with nothing to show do not show.
  const start = gettingStarted(page.data);
  const balances = accountBalances(page.data.accounts, page.data.transactions, today);
  // «In your accounts» lists accounts, as `gettingStarted` counts them: a goal is not one.
  const liveAccounts = page.data.accounts.filter(
    (account) => account.archivedAt === null && !isPocket(account),
  );

  const money = (minor: number) => formatMoney(minor, currency, locale);
  const percent = (ratio: number) => t('targets.percent', { value: Math.round(ratio * 100) });

  // ---- Summary (H5) ---------------------------------------------------------------------------
  const delta = view.trend.delta;
  const dayDates = Array.from({ length: Math.max(period.length, 1) }, (_, index) =>
    formatDayMonth(addDays(period.range.start, index), locale),
  );

  // ---- Transactions (H7, H8) ------------------------------------------------------------------
  const txRow = (row: HomeRow, upcoming: boolean) => (
    <Link
      key={row.id}
      className={`${styles.row} ${upcoming ? styles.rowUp : ''}`}
      href={`/transactions?t=${row.id}`}
    >
      <time className={styles.rowDate} dateTime={row.date}>
        {formatDayMonth(row.date, locale)}
      </time>
      <span className={styles.rowIcon} style={{ color: tint(row.colorIndex) }}>
        <Icon name={row.icon as IconName} size={16} />
      </span>
      <span className={styles.rowText}>
        <b>{row.title}</b>
        {row.recurring ? (
          <>
            <Icon name="repeat" size={12} className={styles.rowRepeat} />
            <VisuallyHidden>{t('recurrence.recurringRow')}</VisuallyHidden>
          </>
        ) : null}
        <span>{row.subtitle}</span>
      </span>
      <AmountText
        minor={row.amount.minor}
        currency={currency}
        locale={locale}
        sign={row.amount.signDisplay}
        muted={upcoming || row.amount.muted}
      />
    </Link>
  );
  const showUpcoming = period.isCurrent && view.upcoming.count > 0;
  const newTransaction = (
    <NewTransactionLink className={styles.primaryAction}>
      <Icon name="plus" size={15} />
      {t('web.shell.newTransaction')}
    </NewTransactionLink>
  );
  const emptyTransactions = (
    <div className={styles.empty}>
      <EmptyState title={t('transactions.empty')} body={t('transactions.emptyBody')} />
      {newTransaction}
    </div>
  );

  // ---- Budget (H6, D5) ------------------------------------------------------------------------
  const budgets = budgetRowFor({
    t,
    money,
    percent,
    categories: page.data.categories,
    styles,
    href: (item) => `/profile/budgets?b=${item.budget.id}`,
  });
  const featured = view.budgets.items.find((item) => item.budget.id === view.budgets.featuredId);
  const advice = view.budgets.advice;
  const adviceSentence = (sentence: BudgetAdvice, item: BudgetView): ReactNode => {
    const end = formatDayMonth(item.range.end, locale);
    if (sentence.kind === 'perDay') {
      return <Rich text={t('targets.perDay', { amount: money(sentence.perDay), end })} />;
    }
    if (sentence.kind === 'overLimit') {
      return <Rich text={t('targets.overLimitAction', { amount: money(sentence.overrun) })} />;
    }
    return null;
  };
  const budgetTile = (item: BudgetView) => {
    const tone = budgets.tone(item);
    return (
      <Link
        key={item.budget.id}
        className={styles.tile}
        href={`/profile/budgets?b=${item.budget.id}`}
      >
        <VisuallyHidden>{budgets.label(item)}</VisuallyHidden>
        <span className={styles.tileBody} aria-hidden="true">
          <TargetRing
            size={BUDGET_RING}
            ratio={item.ratio}
            pace={budgets.pace(item)}
            tone={tone}
            icon={item.budget.icon as IconName}
            colorIndex={budgets.colour(item)}
          />
          <span className={styles.tileName}>{item.budget.name}</span>
          <span className={item.overLimit ? styles.tileOver : styles.tileValue}>
            {item.overLimit
              ? t('targets.overLimitBy', { amount: money(item.spent - item.limit) })
              : t('targets.left', { amount: money(item.limit - item.spent) })}
          </span>
          <span className={styles.tileNote}>
            {t('targets.spent', { amount: money(item.spent) })}
          </span>
          <span className={styles.tileNote}>
            {item.open ? (
              budgetStatus(item, { t, money })
            ) : (
              <Rich text={t('targets.closed', { percent: percent(item.ratio) })} />
            )}
          </span>
        </span>
      </Link>
    );
  };
  const budgetStatusLine = budgetCardStatusText(
    view.budgets.items.length,
    view.budgets.status,
    t,
    locale,
  );

  // ---- Goals (H9) -----------------------------------------------------------------------------
  const goalDeps: GoalTextDeps = { t, locale, money, today, periodKind: settings.periodKind };
  const goalWebTone = (item: GoalView): 'normal' | 'over' | 'done' => {
    const tone = goalTone(item.progress);
    return tone === 'attention' ? 'over' : tone === 'plain' ? 'normal' : 'done';
  };
  const goalRow = (item: GoalView) => (
    <Link key={item.account.id} className={styles.goal} href={`/accounts?g=${item.account.id}`}>
      <VisuallyHidden>{goalLabel(item, goalDeps)}</VisuallyHidden>
      <TargetRing
        size={GOAL_RING}
        ratio={item.progress.ratio}
        pace={goalPace(item.progress)}
        tone={goalWebTone(item)}
        icon={item.account.icon as IconName}
        colorIndex={item.account.colorIndex}
      />
      <span className={styles.goalText} aria-hidden="true">
        <b>{item.account.name}</b>
        <span>{goalOf(item, goalDeps)}</span>
      </span>
      <span className={styles.goalValue} aria-hidden="true">
        {percent(item.progress.ratio)}
        <small className={goalWebTone(item) === 'over' ? styles.attention : undefined}>
          {goalStatus(item, goalDeps)}
        </small>
      </span>
    </Link>
  );
  const goalStatusLine = goalCardStatusText(view.goals.items.length, view.goals.status, t, locale);

  return (
    <div className={styles.page}>
      <div className={styles.head}>
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
      </div>

      {/* Getting started (W11) */}
      {start.show ? (
        <section className={styles.box} aria-labelledby="start-title">
          <div className={styles.blockHead}>
            <h2 id="start-title">{t('home.startTitle')}</h2>
            <span className={styles.meta}>
              {t('home.startProgress', { done: start.done, count: start.steps.length })}
            </span>
          </div>
          <ol className={styles.steps}>
            {start.steps.map((step) => {
              const action =
                step.key === 'account' ? (
                  <Link className={styles.action} href="/accounts?new">
                    {t('accounts.newAccount')}
                  </Link>
                ) : step.key === 'transaction' ? (
                  <NewTransactionLink className={styles.action}>
                    {t('web.shell.newTransaction')}
                  </NewTransactionLink>
                ) : step.key === 'budget' ? (
                  <Link className={styles.action} href="/profile/budgets?new">
                    {t('budgets.create')}
                  </Link>
                ) : (
                  <Link className={styles.action} href={NEW_GOAL_HREF}>
                    {t('goals.create')}
                  </Link>
                );
              const body =
                step.key === 'account'
                  ? start.firstAccount === null
                    ? null
                    : `${start.firstAccount.name} · ${money(balances.get(start.firstAccount.id) ?? 0)}`
                  : step.key === 'transaction'
                    ? t('home.stepTransactionBody')
                    : step.key === 'budget'
                      ? t('home.stepBudgetBody')
                      : t('home.stepGoalBody');
              const title = {
                account: t('home.stepAccount'),
                transaction: t('home.stepTransaction'),
                budget: t('home.stepBudget'),
                goal: t('home.stepGoal'),
              }[step.key];
              return (
                <li key={step.key} className={styles.step} data-done={step.done ? '' : undefined}>
                  <span className={styles.stepMark} aria-hidden="true">
                    {step.done ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className={styles.stepText}>
                    <b>{title}</b>
                    {body === null ? null : <span>{body}</span>}
                  </span>
                  {step.done ? null : action}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* In your accounts (W11): no transaction yet, so the balances come before the summary */}
      {start.noTransactions && liveAccounts.length > 0 ? (
        <section className={styles.box} aria-labelledby="in-accounts-title">
          <div className={styles.blockHead}>
            <h2 id="in-accounts-title">{t('home.inAccounts')}</h2>
          </div>
          {liveAccounts.map((account) => (
            <Link key={account.id} className={styles.accountRow} href={`/accounts?a=${account.id}`}>
              <span>{account.name}</span>
              <AmountText
                minor={balances.get(account.id) ?? 0}
                currency={currency}
                locale={locale}
              />
            </Link>
          ))}
        </section>
      ) : null}

      {/* Summary (H5) */}
      {start.noTransactions ? null : (
        <section className={`${styles.box} ${styles.summary}`} aria-label={t('home.remaining')}>
          <div>
            <div className={styles.figure}>
              <span className={styles.label}>
                {period.isCurrent ? t('home.remaining') : t('home.leftover')}
              </span>
              <AmountText
                minor={view.summary.remaining}
                currency={currency}
                locale={locale}
                size="hero"
              />
            </div>
            <dl className={styles.stats}>
              <div>
                <dt>{t('home.income')}</dt>
                <dd>
                  <AmountText
                    minor={view.summary.income}
                    currency={currency}
                    locale={locale}
                    positive
                  />
                </dd>
              </div>
              <div>
                <dt>{t('home.expenses')}</dt>
                <dd>
                  <AmountText minor={view.summary.spent} currency={currency} locale={locale} />
                </dd>
              </div>
              <div>
                <dt>{t('home.vsUsual')}</dt>
                <dd
                  className={
                    delta === null ? styles.muted : delta > 0 ? styles.attention : styles.positive
                  }
                >
                  {delta === null ? '—' : formatMoney(delta, currency, locale, 'always')}
                </dd>
              </div>
            </dl>
          </div>
          {view.trend.current.length === 0 && view.trend.usual.length === 0 ? (
            <div className={styles.chartEmpty}>{t('stats.empty')}</div>
          ) : (
            <TrendScrub
              current={view.trend.current}
              usual={view.trend.usual}
              span={period.length}
              dates={dayDates}
              currentAmounts={view.trend.current.map((value) => money(value))}
              usualAmounts={view.trend.usual.map((value) => money(value))}
              strings={{
                label: t('stats.cycleTrend'),
                thisPeriod: t('home.trendThisPeriod'),
                usual: t('home.trendUsual'),
                spentBy: dayDates.map((date) => t('home.trendSpentBy', { date })),
                usualBy: dayDates.map((date) => t('home.trendUsualBy', { date })),
                hint: t('home.trendHint'),
              }}
            />
          )}
        </section>
      )}

      {/* Budget (H6) */}
      {view.budgets.items.length === 0 ? null : (
        <section className={styles.box}>
          <div className={styles.blockHead}>
            <h2>{t('home.budget')}</h2>
            <span className={styles.meta}>{budgetStatusLine}</span>
            <Link className={styles.headLink} href="/profile/budgets">
              {t('targets.allBudgets')}
              <Icon name="chevR" size={15} />
            </Link>
          </div>
          {period.isCurrent &&
          featured !== undefined &&
          advice !== null &&
          advice.kind !== 'closed' ? (
            <p className={styles.advice}>
              <b className={styles.strong}>{featured.budget.name}.</b>{' '}
              {adviceSentence(advice, featured)}
            </p>
          ) : null}
          <div className={styles.rings}>{view.budgets.items.map(budgetTile)}</div>
          <Link className={styles.foot} href="/profile/budgets?new">
            <span>
              {t('home.unbudgeted')}{' '}
              <b className={styles.strong}>{money(view.budgets.unbudgeted)}</b>
            </span>
            <span className={styles.footAction}>{t('targets.createBudget')}</span>
          </Link>
        </section>
      )}

      {/* Transactions (H7, H8) */}
      {start.noTransactions ? null : (
        <section className={styles.box}>
          <div className={styles.blockHead}>
            <h2>{t('tabs.transactions')}</h2>
            {showUpcoming ? (
              <span className={styles.meta}>
                {plural(t, locale, 'home.upcomingSummary', view.upcoming.count, {
                  amount: formatMoney(view.upcoming.net, currency, locale, 'always'),
                })}
              </span>
            ) : null}
            <Link className={styles.headLink} href="/transactions">
              {t('home.allTransactions')}
              <Icon name="chevR" size={15} />
            </Link>
          </div>
          {view.recent.length === 0 && !showUpcoming ? (
            emptyTransactions
          ) : period.isCurrent ? (
            <div className={styles.halves}>
              <div>
                <span className={styles.group}>{t('home.latest')}</span>
                {view.recent.length === 0
                  ? emptyTransactions
                  : view.recent.map((row) => txRow(row, false))}
              </div>
              {showUpcoming ? (
                <div>
                  <span className={styles.group}>
                    {t('home.upcomingUntil', { date: formatDayMonth(period.range.end, locale) })}
                  </span>
                  {view.upcoming.rows.map((row) => txRow(row, true))}
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <span className={styles.group}>{t('home.latest')}</span>
              <div className={styles.halves}>
                <div>{view.recent.slice(0, HOME_ROWS).map((row) => txRow(row, false))}</div>
                <div>{view.recent.slice(HOME_ROWS).map((row) => txRow(row, false))}</div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Goals (H9) */}
      {view.goals.items.length === 0 ? null : (
        <section className={styles.box}>
          <div className={styles.blockHead}>
            <h2>{t('goals.title')}</h2>
            <span className={styles.meta}>{goalStatusLine}</span>
            <Link className={styles.headLink} href="/accounts">
              {t('goals.all')}
              <Icon name="chevR" size={15} />
            </Link>
          </div>
          <div className={styles.goals}>{view.goals.items.map(goalRow)}</div>
        </section>
      )}
    </div>
  );
}
