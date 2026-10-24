import { isWithin, nearestPeriodWithData } from '@saldo/core';
import {
  formatCycleRange,
  formatLongDate,
  formatMajor,
  formatMoney,
  formatPeriodTick,
  formatSignedPercent,
  plural,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { Fragment, type ReactNode } from 'react';
import {
  PERIOD_PARAM,
  periodFromParam,
  periodHref,
  periodSteps,
} from '../../../src/features/period/periodParams';
import { expensesChartView } from '../../../src/features/stats/expensesChart';
import { forecastView } from '../../../src/features/stats/forecastView';
import { navigatorForecast, navigatorView } from '../../../src/features/stats/navigatorView';
import { periodProjection, SPLIT_COLOURS, statsView } from '../../../src/features/stats/statsView';
import { filtersFromSearch } from '../../../src/features/transactions/listParams';
import { listView } from '../../../src/features/transactions/listView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { ExpensesChart, type ExpensesChartBar } from '../../../src/ui/charts/ExpensesChart';
import { HistoryBars } from '../../../src/ui/charts/HistoryBars';
import { SplitBar, type SplitSegment } from '../../../src/ui/charts/SplitBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { paletteIndex } from '../../../src/ui/IconBox';
import { ListRow } from '../../../src/ui/ListRow';
import { NewTransactionLink } from '../../../src/ui/NewTransactionLink';
import { PanelLink } from '../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../src/ui/PanelSwitch';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { PeriodKeys } from '../../../src/ui/PeriodKeys';
import { Section } from '../../../src/ui/Section';
import { SegmentedLinks } from '../../../src/ui/SegmentedLinks';
import styles from './stats.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/stats';

/** Which direction the breakdown reads: «Expenses» and «Income», two tool buttons. */
const DIRECTION_PARAM = 'direction';

/** D8: a category row opens its dialog, `?c=`; the key is `c:{categoryId}`. */
const PANEL_PARAMS = { flags: [], values: ['c'] } as const;

/** How many of a category's transactions its dialog lists. */
const CATEGORY_ROWS = 5;

/** The spec's «last six periods» of a category's dialog: the selected one and the five before it. */
const HISTORY_BARS = 6;

/** The name a category no longer in the list takes, as on the phone. */
const GREY = 'var(--color-bar-grey)';

/** A category colour as the CSS variable the root layout injects; grey for a row with none. */
function tint(colorIndex: number | null | undefined): string {
  return colorIndex === null || colorIndex === undefined
    ? GREY
    : `var(--category-${paletteIndex(colorIndex)})`;
}

/** The catalogs' one piece of markup: `<b>` around a term, as Home renders it. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/<b>|<\/b>/).map((part, index) =>
        index % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed sentence, in order.
          <b key={index}>{part}</b>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed sentence, in order.
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** A figure of the period block: the label, the amount, and an optional line under it. */
function Figure({
  label,
  note,
  hero = false,
  children,
}: {
  label: string;
  note?: string;
  hero?: boolean;
  children: ReactNode;
}) {
  return (
    // A figure captioned by its label: the amount reads as one thing, apart from the legend's words.
    <figure className={hero ? styles.hero : styles.figure}>
      <figcaption className={styles.label}>{label}</figcaption>
      {children}
      {note === undefined || note === '' ? null : <span className={styles.note}>{note}</span>}
    </figure>
  );
}

/**
 * Statistics on the web (W6–W8): how this period compares with the others, and where the money
 * went. The period block holds the figures and «Expenses by period», which is the period picker.
 * A closed or running period then shows the breakdown and the tags; a forecast period shows the
 * recurring transactions it expects and the table of the forecast periods.
 *
 * Every figure is `statsView`, `navigatorView`, `forecastView` and `expensesChartView` — the same
 * `@saldo/core` the phone calls. Nothing is added up here.
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, params } = page;

  // The forecast first: how many periods `?p=` may reach ahead is how many forecast columns there
  // are, so the period cannot be read before it is known.
  const forecast = navigatorForecast({ data: page.data, def, today });
  const reach = forecast?.length ?? 0;
  const period = periodFromParam(def, today, params[PERIOD_PARAM], reach);
  const navigator = navigatorView({
    data: page.data,
    def,
    today,
    selected: period.range,
    forecast,
  });

  const direction = params[DIRECTION_PARAM] === 'income' ? 'income' : 'expense';
  // What every link on this page keeps. The period is not one of them: `periodHref` writes it.
  const keep: Record<string, string> =
    direction === 'income' ? { [DIRECTION_PARAM]: direction } : {};
  const directionHref = (which: 'expense' | 'income') =>
    periodHref(
      PATH,
      period.range,
      def,
      today,
      which === 'income' ? { [DIRECTION_PARAM]: which } : {},
    );
  const transactionsHref = (query: Record<string, string>) => {
    const search = new URLSearchParams(query);
    const p = params[PERIOD_PARAM];
    if (p !== undefined) search.set(PERIOD_PARAM, p);
    return `/transactions?${search.toString()}`;
  };
  const money = (minor: number) => formatMoney(minor, currency, locale);

  // ---- The chart (W6) -------------------------------------------------------------------------
  const major = (minor: number) => formatMajor(minor, currency, locale, 'never');
  const running = navigator.columns.find((column) => column.kind === 'current');
  const runningProjection =
    running === undefined
      ? null
      : periodProjection({ txs: page.data.transactions, def, range: running.range, today });
  const chart = expensesChartView({ columns: navigator.columns, projection: runningProjection });
  const bars: ExpensesChartBar[] = chart.bars.map((bar) => {
    const { column } = bar;
    const amount = major(bar.amount);
    const range = column.values.forecast;
    const rangeText = formatCycleRange(column.range, locale, today);
    const tipTitle =
      column.kind === 'forecast'
        ? `${rangeText} · ${t('period.forecast')}`
        : column.kind === 'current'
          ? `${rangeText} · ${t('period.running')}`
          : rangeText;
    // The tooltip says what the bar shows, then what it means against «usual» or the forecast.
    const tipLines =
      column.kind === 'forecast'
        ? [
            t('stats.tipForecast', { amount }),
            ...(range === undefined
              ? []
              : [t('stats.forecastRange', { min: major(range.min), max: major(range.max) })]),
          ]
        : column.kind === 'current'
          ? [
              t('stats.tipSpentSoFar', { amount: money(bar.amount) }),
              ...(runningProjection === null
                ? []
                : [t('stats.tipEndAbout', { amount: major(runningProjection) })]),
            ]
          : [
              t('stats.tipSpent', { amount: money(bar.amount) }),
              ...(chart.usual === null
                ? []
                : [
                    t(bar.amount >= chart.usual ? 'stats.aboveUsual' : 'stats.belowUsual', {
                      amount: major(Math.abs(bar.amount - chart.usual)),
                    }),
                  ]),
            ];
    return {
      key: column.range.start,
      href: periodHref(PATH, column.range, def, today, keep),
      tick: formatPeriodTick(column.range.start, def.kind, locale),
      value: column.kind === 'forecast' ? t('common.approx', { amount }) : amount,
      label: [tipTitle, ...tipLines].join(' · '),
      tipTitle,
      tipLines,
      kind: column.kind,
      selected: column.selected,
      height: bar.height,
      projectionHeight: bar.projectionHeight,
    };
  });
  const chartBlock = (
    <>
      <div className={styles.chartHead}>
        <h2 className={styles.chartTitle}>{t('stats.expensesByPeriod')}</h2>
        {/* The key of the chart: what each mark means. The bars say it again in their labels. */}
        <ul className={styles.legend} aria-hidden="true">
          <li>
            <i className={styles.keySpent} />
            {t('stats.legendExpenses')}
          </li>
          {bars.some((bar) => bar.kind === 'forecast') ? (
            <li>
              <i className={styles.keyForecast} />
              {t('stats.legendForecast')}
            </li>
          ) : null}
          {chart.usual === null ? null : (
            <li>
              <i className={styles.keyUsual} />
              {t('stats.usual')}
            </li>
          )}
        </ul>
      </div>
      <ExpensesChart bars={bars} usualHeight={chart.usualHeight} />
      <p className={styles.chartFoot}>
        {chart.usual === null ? null : (
          <>
            <Rich text={t('stats.usualNote', { amount: major(chart.usual) })} />{' '}
          </>
        )}
        {t('stats.pickPeriod')}
      </p>
    </>
  );

  const { previous: previousHref, next: nextHref } = periodSteps(
    def,
    period.range,
    today,
    PATH,
    keep,
    reach,
  );
  const header = (
    <>
      <PeriodHeader
        period={period}
        def={def}
        today={today}
        locale={locale}
        path={PATH}
        params={keep}
        reach={reach}
        status={
          period.ahead > 0
            ? t('period.forecast')
            : period.isCurrent
              ? t('period.inProgress', { elapsed: period.elapsed, length: period.length })
              : t('period.closed')
        }
        strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
      />
      <PeriodKeys previousHref={previousHref} nextHref={nextHref} />
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // A forecast period: what it expects, and the table of the periods ahead (§5.17).
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const selectedForecast = navigator.selected === null ? null : navigator.selected.forecast;
  if (period.ahead > 0 && forecast !== null && selectedForecast !== null) {
    const view = forecastView({
      recurrences: page.data.recurrences,
      periods: forecast,
      selected: selectedForecast,
    });
    const selected = view.selected;
    const categories = new Map(page.data.categories.map((category) => [category.id, category]));

    return (
      <div className={styles.page}>
        {header}
        <section className={styles.box} aria-label={t('stats.expensesByPeriod')}>
          <div className={styles.figures}>
            <Figure
              hero
              label={t('stats.expensesAbout')}
              note={t('stats.forecastRange', {
                min: major(selected.expensesMin),
                max: major(selected.expensesMax),
              })}
            >
              <AmountText
                minor={selected.expenses}
                currency={currency}
                locale={locale}
                size="hero"
              />
            </Figure>
            <div className={styles.stats}>
              <Figure label={t('stats.incomeAbout')} note={t('stats.fromRecurrences')}>
                <AmountText
                  minor={selected.income}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  positive
                />
              </Figure>
              <Figure label={t('stats.netAbout')}>
                <AmountText
                  minor={view.net}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  sign="always"
                />
              </Figure>
              <Figure
                label={t('stats.balanceAbout')}
                note={t('stats.atDate', { date: formatLongDate(selected.range.end, locale) })}
              >
                <AmountText
                  minor={selected.balance}
                  currency={currency}
                  locale={locale}
                  size="headline"
                />
              </Figure>
            </div>
          </div>
          {chartBlock}
        </section>

        <div className={styles.pair}>
          <section className={styles.box}>
            <div className={styles.boxHead}>
              <h2 className={styles.boxTitle}>{t('stats.forecastRecurrences')}</h2>
              <span className={styles.status}>
                {formatCycleRange(selected.range, locale, today)}
              </span>
            </div>
            {view.recurrences.length === 0 ? (
              <EmptyState title={t('stats.forecastNoRecurrences')} />
            ) : (
              view.recurrences.map((row) => {
                const category =
                  row.categoryId === null ? undefined : categories.get(row.categoryId);
                return (
                  <ListRow
                    key={row.recurrenceId}
                    open
                    icon={category?.icon as IconName | undefined}
                    colorIndex={category?.colorIndex}
                    title={
                      row.description === ''
                        ? (category?.name ?? t('common.missing'))
                        : row.description
                    }
                    subtitle={
                      row.count > 1
                        ? plural(t, locale, 'stats.forecastTimes', row.count)
                        : undefined
                    }
                    trailing={
                      <AmountText
                        minor={row.kind === 'income' ? row.total : -row.total}
                        currency={currency}
                        locale={locale}
                        sign="always"
                      />
                    }
                  />
                );
              })
            )}
          </section>

          <section className={styles.box}>
            <div className={styles.boxHead}>
              <h2 className={styles.boxTitle}>{t('stats.forecastPeriods')}</h2>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('stats.forecastColAt')}</th>
                  <th scope="col">{t('stats.expensesAbout')}</th>
                  <th scope="col" className={styles.rangeCol}>
                    {t('stats.forecastColRange')}
                  </th>
                  <th scope="col">{t('stats.balanceAbout')}</th>
                </tr>
              </thead>
              <tbody>
                {view.periods.map((entry) => (
                  <tr
                    key={entry.range.start}
                    className={
                      entry.range.start === selected.range.start ? styles.tableSelected : ''
                    }
                  >
                    <th scope="row">{formatLongDate(entry.range.end, locale)}</th>
                    <td>{money(entry.expenses)}</td>
                    <td className={`${styles.faint} ${styles.rangeCol}`}>
                      {t('stats.forecastRange', {
                        min: major(entry.expensesMin),
                        max: major(entry.expensesMax),
                      })}
                    </td>
                    <td>{money(entry.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* «How it's calculated» is a line at the bottom of «Forecast periods». */}
            <p className={styles.foot}>
              <b>{t('stats.forecastHowTitle')}</b> {t('stats.forecastHow')}
            </p>
          </section>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // A running or closed period: the period block, the breakdown, the tags.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const view = statsView({ data: page.data, def, today, period, direction });
  const tagNames = new Map(page.data.tags.map((tag) => [tag.id, tag.name]));
  // W11: a period with no row at all. The chart stays; the breakdown and the tags give the way out.
  const periodEmpty = !page.data.transactions.some((tx) => isWithin(period.range, tx.date));
  const nearestWithData = periodEmpty
    ? nearestPeriodWithData({ txs: page.data.transactions, def, period: period.range })
    : null;
  const anyTagIncome = view.tags.tags.some((row) => row.income > 0);

  // W7: each row in the colour of its category; past the sixth, the bar shares one grey segment.
  const ranked = view.split.rows.map((row) => ({ row, colour: tint(row.category?.colorIndex) }));
  const segments: SplitSegment[] = [
    ...ranked.slice(0, SPLIT_COLOURS).map(({ row, colour }) => ({
      key: row.categoryId,
      amount: row.amount,
      colour,
    })),
    {
      key: 'other',
      amount: view.split.other,
      colour: GREY,
    },
  ];

  const projection = view.figures.projection;
  const median = view.figures.median;
  // Under Expenses: «so far» while the period runs, and how a closed one sat against the median.
  const spentNote =
    period.isCurrent || median === null
      ? period.isCurrent
        ? t('stats.soFar')
        : undefined
      : t(view.figures.spent >= median ? 'stats.aboveMedian' : 'stats.belowMedian', {
          amount: money(Math.abs(view.figures.spent - median)),
        });
  const projectionNote =
    projection === null || chart.usual === null
      ? undefined
      : t(projection >= chart.usual ? 'stats.projectionAboveShort' : 'stats.projectionBelowShort', {
          amount: money(Math.abs(projection - chart.usual)),
        });

  const baseHref = periodHref(PATH, period.range, def, today, keep);
  const categoryHref = (categoryId: string) =>
    periodHref(PATH, period.range, def, today, { ...keep, c: categoryId });
  const deltaText = (delta: number | null) =>
    delta === null
      ? t('stats.newLabel')
      : t('stats.vsUsual', { delta: formatSignedPercent(delta) });

  // W7: a row's share bar is relative to the largest category, which fills its track.
  const largest = ranked[0]?.row.amount ?? 0;
  const shareWidth = (amount: number) => (largest <= 0 ? 0 : (amount / largest) * 100);
  const historyPeriods = view.split.periods.slice(-HISTORY_BARS);

  // Every category's dialog, rendered here: a click only chooses one (`PanelSwitch`).
  const panels: Record<string, PanelSpec> = {};
  for (const { row, colour } of ranked) {
    const rows = listView({
      data: page.data,
      filters: filtersFromSearch({ category: row.categoryId, direction }),
      today,
      period,
      kindLabel: (kind) => t(`kinds.${kind}`),
    })
      .days.flatMap((day) => day.rows)
      .slice(0, CATEGORY_ROWS);
    const history = row.history.slice(-HISTORY_BARS);
    panels[`c:${row.categoryId}`] = {
      title: row.category?.name ?? t('common.missing'),
      icon:
        row.category === undefined ? undefined : (
          <span className={styles.dialogIcon} style={{ color: colour }}>
            <Icon name={row.category.icon as IconName} size={18} />
          </span>
        ),
      body: (
        <>
          <Figure
            label={direction === 'income' ? t('stats.income') : t('stats.expenses')}
            note={[t('stats.ofTotal', { pct: row.share }), deltaText(row.delta)].join(' · ')}
          >
            <AmountText
              minor={row.amount}
              currency={currency}
              locale={locale}
              size="large"
              positive={direction === 'income'}
            />
          </Figure>
          <Section
            open
            title={plural(t, locale, 'stats.lastPeriods', history.length)}
            trailing={
              row.baseline === null
                ? undefined
                : t('stats.dashedMedian', { amount: major(row.baseline) })
            }
          >
            <HistoryBars
              colour={colour}
              median={row.baseline}
              bars={history.map((amount, index) => {
                const range = historyPeriods[index];
                return {
                  key: range?.start ?? `${index}`,
                  tick: range === undefined ? '' : formatPeriodTick(range.start, def.kind, locale),
                  amount,
                };
              })}
            />
          </Section>
          <Section
            open
            title={t('tabs.transactions')}
            trailing={
              <Link
                className={styles.more}
                href={transactionsHref({ category: row.categoryId })}
                aria-label={t('home.allTransactions')}
              >
                <span>{t('stats.allShort')}</span>
                <Icon name="chevR" size={14} />
              </Link>
            }
          >
            {rows.length === 0 ? (
              <EmptyState title={t('stats.empty')} />
            ) : (
              rows.map((tx) => (
                <ListRow
                  key={tx.id}
                  open
                  href={`/transactions?t=${tx.id}`}
                  icon={tx.icon as IconName}
                  colorIndex={tx.colorIndex}
                  title={tx.title}
                  subtitle={tx.subtitle}
                  trailing={
                    <AmountText
                      minor={tx.amount.minor}
                      currency={currency}
                      locale={locale}
                      sign={tx.amount.signDisplay}
                    />
                  }
                />
              ))
            )}
          </Section>
        </>
      ),
    };
  }

  return (
    <PanelSwitch
      baseHref={baseHref}
      params={PANEL_PARAMS}
      panels={panels}
      closeLabel={t('common.close')}
    >
      <div className={styles.page}>
        {header}

        {/* The period block: Expenses, then Income, Net and the projection; the chart under them. */}
        <section className={styles.box} aria-label={t('stats.expensesByPeriod')}>
          <div className={styles.figures}>
            <Figure hero label={t('stats.expenses')} note={spentNote}>
              <AmountText
                minor={view.figures.spent}
                currency={currency}
                locale={locale}
                size="hero"
              />
            </Figure>
            <div className={styles.stats}>
              <Figure label={t('stats.income')}>
                <AmountText
                  minor={view.figures.income}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  positive
                />
              </Figure>
              <Figure label={t('stats.net')}>
                <AmountText
                  minor={view.figures.net}
                  currency={currency}
                  locale={locale}
                  size="headline"
                  sign="always"
                />
              </Figure>
              {projection === null ? null : (
                <Figure label={t('stats.projection')} note={projectionNote}>
                  <AmountText
                    minor={projection}
                    currency={currency}
                    locale={locale}
                    size="headline"
                  />
                </Figure>
              )}
            </div>
          </div>
          {chartBlock}
        </section>

        {periodEmpty ? (
          <section className={styles.box}>
            <p className={styles.emptyTitle}>
              {t('stats.emptyPeriod', {
                period: formatCycleRange(period.range, locale, today),
              })}
            </p>
            <div className={styles.emptyActions}>
              {nearestWithData === null ? null : (
                <Link
                  className={styles.emptyAction}
                  href={periodHref(PATH, nearestWithData, def, today, keep)}
                >
                  {t('stats.goToPeriod', {
                    period: formatCycleRange(nearestWithData, locale, today),
                  })}
                </Link>
              )}
              <NewTransactionLink className={styles.emptyAction}>
                {t('web.shell.newTransaction')}
              </NewTransactionLink>
            </div>
          </section>
        ) : (
          <>
            {/* W7: the breakdown, in the colours of the categories. */}
            <section className={styles.box}>
              <div className={styles.boxHead}>
                <h2 className={styles.boxTitle}>{t('stats.split')}</h2>
                <SegmentedLinks
                  options={[
                    {
                      key: 'expense',
                      label: t('stats.expenses'),
                      href: directionHref('expense'),
                      active: direction === 'expense',
                    },
                    {
                      key: 'income',
                      label: t('stats.income'),
                      href: directionHref('income'),
                      active: direction === 'income',
                    },
                  ]}
                />
              </div>
              {view.split.rows.length === 0 ? (
                <EmptyState title={t('stats.empty')} />
              ) : (
                <>
                  <p className={styles.total}>
                    <b>{money(view.split.total)}</b>
                    <span>{plural(t, locale, 'stats.categoryCount', view.split.rows.length)}</span>
                  </p>
                  <SplitBar segments={segments} />
                  <div className={styles.cats}>
                    {ranked.map(({ row, colour }) => (
                      <PanelLink
                        key={row.categoryId}
                        className={styles.cat}
                        selectedClassName={styles.catSelected}
                        selectId={`c:${row.categoryId}`}
                        href={categoryHref(row.categoryId)}
                      >
                        <span className={styles.catIcon} style={{ color: colour }}>
                          {row.category === undefined ? null : (
                            <Icon name={row.category.icon as IconName} size={18} />
                          )}
                        </span>
                        {/* Below 760px the share and the change go under the name, on one line. */}
                        <span className={styles.catText}>
                          <span className={styles.catName}>
                            {row.category?.name ?? t('common.missing')}
                          </span>
                          <span className={styles.catSub}>
                            {t('targets.percent', { value: row.share })} · {deltaText(row.delta)}
                          </span>
                        </span>
                        <span className={styles.catShare}>
                          <span className={styles.track}>
                            <span
                              style={{ width: `${shareWidth(row.amount)}%`, background: colour }}
                            />
                          </span>
                          <span>{t('targets.percent', { value: row.share })}</span>
                        </span>
                        <span className={styles.catDelta}>{deltaText(row.delta)}</span>
                        <span className={styles.catAmount}>
                          <AmountText minor={row.amount} currency={currency} locale={locale} />
                        </span>
                      </PanelLink>
                    ))}
                  </div>
                </>
              )}
              {view.split.excluded.count === 0 ? null : (
                <p className={styles.note}>
                  {plural(t, locale, 'stats.excludedRow', view.split.excluded.count, {
                    amount: money(view.split.excluded.amount),
                  })}
                </p>
              )}
              {/* «Committed share» is a line at the bottom of the block. */}
              {direction === 'expense' && view.split.rows.length > 0 ? (
                <div className={styles.commit}>
                  <b>{t('stats.committed')}</b>
                  <SplitBar
                    segments={[
                      {
                        key: 'committed',
                        amount: view.committed.amount,
                        colour: 'var(--color-text)',
                      },
                      {
                        key: 'discretionary',
                        amount: view.committed.discretionary,
                        colour: 'var(--color-track)',
                      },
                    ]}
                  />
                  <p>
                    {t('stats.committedLine', {
                      pct: view.committed.share,
                      amount: money(view.committed.amount),
                    })}
                  </p>
                </div>
              ) : null}
            </section>

            <section className={styles.box}>
              <div className={styles.boxHead}>
                <h2 className={styles.boxTitle}>{t('stats.tags')}</h2>
                <span className={styles.status}>
                  {anyTagIncome ? t('stats.tagsFlows') : t('stats.expenses')}
                </span>
              </div>
              {view.tags.tags.length === 0 ? (
                <EmptyState title={t('stats.tagsEmpty')} />
              ) : (
                view.tags.tags.map((row) => (
                  // «#casa-nuova 3 usi» on one line, the amounts at the end.
                  <Link
                    key={row.tagId}
                    className={styles.tagRow}
                    href={transactionsHref({ tag: row.tagId })}
                  >
                    <span className={styles.tagName}>
                      <span className={styles.tagHash}>#</span>
                      <span>{tagNames.get(row.tagId) ?? t('common.missing')}</span>
                      <small>{plural(t, locale, 'tags.uses', row.count)}</small>
                    </span>
                    <span className={styles.tagAmounts}>
                      {/* A tag that only brought money in has no spend worth a «0,00» above it. */}
                      {row.expense === 0 && row.income > 0 ? null : (
                        <AmountText minor={row.expense} currency={currency} locale={locale} />
                      )}
                      {row.income === 0 ? null : (
                        <AmountText
                          minor={row.income}
                          currency={currency}
                          locale={locale}
                          size="footnote"
                          sign="always"
                        />
                      )}
                    </span>
                  </Link>
                ))
              )}
              {view.tags.untaggedCount === 0 ? null : (
                <p className={styles.note}>
                  {plural(t, locale, 'stats.tagsUntagged', view.tags.untaggedCount, {
                    amount: money(view.tags.untagged),
                  })}
                </p>
              )}
              {view.tags.tags.length < 2 ? null : (
                <p className={styles.footnote}>{t('stats.tagsOverlap')}</p>
              )}
            </section>
          </>
        )}
      </div>
    </PanelSwitch>
  );
}
