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
import type { ReactNode } from 'react';
import {
  PERIOD_PARAM,
  periodFromParam,
  periodHref,
  periodSteps,
} from '../../../src/features/period/periodParams';
import { expensesChartView } from '../../../src/features/stats/expensesChart';
import { forecastView } from '../../../src/features/stats/forecastView';
import { navigatorForecast, navigatorView } from '../../../src/features/stats/navigatorView';
import { periodProjection, statsView } from '../../../src/features/stats/statsView';
import { filtersFromSearch } from '../../../src/features/transactions/listParams';
import { listView } from '../../../src/features/transactions/listView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { Chip } from '../../../src/ui/Chip';
import { ChartFrame } from '../../../src/ui/charts/ChartFrame';
import { ExpensesChart, type ExpensesChartBar } from '../../../src/ui/charts/ExpensesChart';
import { Sparkline } from '../../../src/ui/charts/Sparkline';
import { SplitBar, type SplitSegment } from '../../../src/ui/charts/SplitBar';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { paletteIndex } from '../../../src/ui/IconBox';
import { ListRow } from '../../../src/ui/ListRow';
import { PanelLink } from '../../../src/ui/PanelNav';
import { type PanelSpec, PanelSwitch } from '../../../src/ui/PanelSwitch';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { PeriodKeys } from '../../../src/ui/PeriodKeys';
import { Section } from '../../../src/ui/Section';
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

/** The name a category no longer in the list takes, as on the phone. */
const MISSING = '—';

/** W7: how many categories keep their own colour in the split bar; the rest share one grey. */
const SPLIT_COLOURS = 6;

const GREY = 'var(--color-bar-grey)';

/** A category colour as the CSS variable the root layout injects; grey for a row with none. */
function tint(colorIndex: number | null | undefined): string {
  return colorIndex === null || colorIndex === undefined
    ? GREY
    : `var(--category-${paletteIndex(colorIndex)})`;
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
    <div className={hero ? styles.hero : styles.figure}>
      <span className={styles.label}>{label}</span>
      {children}
      {note === undefined || note === '' ? null : <span className={styles.note}>{note}</span>}
    </div>
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
  const running = navigator.columns.find((column) => column.kind === 'current');
  const chart = expensesChartView({
    columns: navigator.columns,
    projection:
      running === undefined
        ? null
        : periodProjection({ txs: page.data.transactions, def, range: running.range, today }),
  });
  const bars: ExpensesChartBar[] = chart.bars.map((bar) => {
    const { column } = bar;
    const forecastColumn = column.kind === 'forecast';
    const amount = formatMajor(bar.amount, currency, locale, 'never');
    const range = column.values.forecast;
    return {
      key: column.range.start,
      href: periodHref(PATH, column.range, def, today, keep),
      tick: formatPeriodTick(column.range.start, def.kind, locale),
      value: forecastColumn ? `~${amount}` : amount,
      label: `${formatCycleRange(column.range, locale, today)} · ${
        forecastColumn ? '~' : ''
      }${money(bar.amount)}`,
      detail:
        range === undefined
          ? null
          : t('stats.forecastRange', {
              min: formatMajor(range.min, currency, locale, 'never'),
              max: formatMajor(range.max, currency, locale, 'never'),
            }),
      kind: column.kind,
      selected: column.selected,
      height: bar.height,
      projectionHeight: bar.projectionHeight,
    };
  });
  const chartBlock = (
    <>
      <h2 className={styles.chartTitle}>{t('stats.expensesByPeriod')}</h2>
      <ExpensesChart bars={bars} usualHeight={chart.usualHeight} />
      {chart.usual === null ? null : (
        <p className={styles.chartFoot}>{t('stats.usualNote', { amount: money(chart.usual) })}</p>
      )}
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
            ? undefined
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
                min: formatMajor(selected.expensesMin, currency, locale, 'never'),
                max: formatMajor(selected.expensesMax, currency, locale, 'never'),
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
                  minor={selected.income - selected.expenses}
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
                    title={row.description === '' ? (category?.name ?? MISSING) : row.description}
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
                        min: formatMajor(entry.expensesMin, currency, locale, 'never'),
                        max: formatMajor(entry.expensesMax, currency, locale, 'never'),
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
      amount: ranked.slice(SPLIT_COLOURS).reduce((sum, { row }) => sum + row.amount, 0),
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

  // Every category's dialog, rendered here: a click only chooses one (`PanelSwitch`).
  const panels: Record<string, PanelSpec> = {};
  for (const { row } of ranked) {
    const rows = listView({
      data: page.data,
      filters: filtersFromSearch({ category: row.categoryId, direction }),
      today,
      period,
      kindLabel: (kind) => t(`kinds.${kind}`),
    })
      .days.flatMap((day) => day.rows)
      .slice(0, CATEGORY_ROWS);
    panels[`c:${row.categoryId}`] = {
      title: row.category?.name ?? MISSING,
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
          <ChartFrame title={plural(t, locale, 'stats.lastPeriods', row.history.length)}>
            <Sparkline series={row.history} height={56} />
          </ChartFrame>
          <Section
            open
            title={t('tabs.transactions')}
            more={
              <Link className={styles.more} href={transactionsHref({ category: row.categoryId })}>
                <span>{t('home.allTransactions')}</span>
                <Icon name="chevR" size={16} />
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

        {/* W7: the breakdown, in the colours of the categories. */}
        <section className={styles.box}>
          <div className={styles.boxHead}>
            <h2 className={styles.boxTitle}>{t('stats.split')}</h2>
            <span className={styles.toggle}>
              <Chip
                label={t('stats.expenses')}
                href={directionHref('expense')}
                active={direction === 'expense'}
              />
              <Chip
                label={t('stats.income')}
                href={directionHref('income')}
                active={direction === 'income'}
              />
            </span>
          </div>
          {view.split.rows.length === 0 ? (
            <EmptyState title={t('stats.empty')} />
          ) : (
            <>
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
                    <span className={styles.catName}>{row.category?.name ?? MISSING}</span>
                    <span className={styles.catShare}>
                      <span className={styles.track}>
                        <span style={{ width: `${row.share}%`, background: colour }} />
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
            <p className={styles.foot}>
              <b>{t('stats.committed')}</b>{' '}
              {t('stats.committedLine', {
                pct: view.committed.share,
                amount: money(view.committed.amount),
              })}
            </p>
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
              <ListRow
                key={row.tagId}
                open
                title={tagNames.get(row.tagId) ?? row.tagId}
                subtitle={plural(t, locale, 'tags.uses', row.count)}
                href={transactionsHref({ tag: row.tagId })}
                trailing={
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
                }
              />
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
      </div>
    </PanelSwitch>
  );
}
