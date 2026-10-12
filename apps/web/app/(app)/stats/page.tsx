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
} from '../../../src/features/period/periodParams';
import { forecastView } from '../../../src/features/stats/forecastView';
import {
  type NavigatorColumn,
  navigatorForecast,
  navigatorView,
} from '../../../src/features/stats/navigatorView';
import { statsView } from '../../../src/features/stats/statsView';
import { filtersFromSearch } from '../../../src/features/transactions/listParams';
import { listView } from '../../../src/features/transactions/listView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { Card, CardGrid, CardHead, CardLabel, CardNote } from '../../../src/ui/Card';
import { Chip } from '../../../src/ui/Chip';
import { Columns } from '../../../src/ui/Columns';
import { CashflowChart } from '../../../src/ui/charts/CashflowChart';
import { ChartFrame } from '../../../src/ui/charts/ChartFrame';
import { Sparkline } from '../../../src/ui/charts/Sparkline';
import { SplitBar, type SplitSegment } from '../../../src/ui/charts/SplitBar';
import { TrendChart } from '../../../src/ui/charts/TrendChart';
import { EmptyState } from '../../../src/ui/EmptyState';
import { HeroFigure } from '../../../src/ui/HeroBand';
import { Icon } from '../../../src/ui/Icon';
import { IconBox } from '../../../src/ui/IconBox';
import { ListRow } from '../../../src/ui/ListRow';
import { PageHead } from '../../../src/ui/PageHead';
import { type PanelSpec, PanelSwitch } from '../../../src/ui/PanelSwitch';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { Section } from '../../../src/ui/Section';
import styles from './stats.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/stats';

/** Which direction Ripartizione is reading; the phone's segmented control, as two chips. */
const DIRECTION_PARAM = 'direction';

/** D8: a category card opens its panel, `?c=`; the key is `c:{categoryId}`. */
const PANEL_PARAMS = { flags: [], values: ['c'] } as const;

/** How many of a category's transactions its panel lists. */
const CATEGORY_ROWS = 5;

/** The name a category no longer in the list takes, as on the phone. */
const MISSING = '—';

/**
 * How many categories keep a colour of their own in Ripartizione's bar; the rest share
 * `--color-segment-other`, as the design does — a sixth hue would be a hue nobody can name.
 */
const SPLIT_SEGMENTS = 5;

/** A category's colour in the bar and in the dot beside its row. */
function segmentColour(rank: number): string {
  return rank < SPLIT_SEGMENTS ? `var(--color-segments-${rank})` : 'var(--color-segment-other)';
}

/** A key figure of the band: the label, the amount, and the line the design puts under it. */
function Figure({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <HeroFigure label={label}>
      {children}
      {note === undefined || note === '' ? null : <span className={styles.note}>{note}</span>}
    </HeroFigure>
  );
}

/**
 * Statistiche on the web (§17.1.7): Flussi spans the page with ten columns — six closed periods,
 * the one running and the three forecast ones — and **is** the period picker, so a column, like the
 * ‹ › beside it, is a link to its own period. Everything below follows the pick: a closed or running
 * period gets Andamento, Quota impegnata, Ripartizione and Tag; a forecast one gets how the forecast
 * is made, the table of the periods ahead and what repeats in that one, which is why the phone's
 * forecast sheet has no web counterpart.
 *
 * Every figure is `statsView`, `navigatorView` and `forecastView` — the same `@saldo/core` the phone
 * calls. Nothing is added up here.
 */
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, params } = page;

  // The forecast first: how many periods `?p=` may reach ahead is how many forecast columns there
  // are, so the period cannot be read before it is known. `page.period` is therefore not used on
  // this one page — it was resolved with no reach, and would clamp a forecast column back to today.
  const forecast = navigatorForecast({ data: page.data, def, today });
  const period = periodFromParam(def, today, params[PERIOD_PARAM], forecast?.length ?? 0);
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
  /** The same period, reading the other direction: what Ripartizione's two chips link to. */
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

  const chart = (
    <Section open title={t('stats.cashflow')}>
      <CashflowChart
        columns={navigator.columns}
        currency={currency}
        locale={locale}
        href={(column: NavigatorColumn) => periodHref(PATH, column.range, def, today, keep)}
        tick={(column: NavigatorColumn) => formatPeriodTick(column.range.start, def.kind, locale)}
        label={(column: NavigatorColumn) =>
          `${formatCycleRange(column.range, locale, today)} · ${formatMoney(column.net, currency, locale, 'always')}`
        }
        legend={{
          income: t('stats.legendIncome'),
          expenses: t('stats.legendExpenses'),
          current: t('stats.legendCurrent'),
          forecast: t('stats.legendForecast'),
          range: t('stats.legendRange'),
        }}
      />
    </Section>
  );

  const header = (
    <PeriodHeader
      period={period}
      def={def}
      today={today}
      locale={locale}
      path={PATH}
      params={keep}
      reach={forecast?.length ?? 0}
      status={
        period.ahead > 0
          ? undefined
          : period.isCurrent
            ? t('period.inProgress', { elapsed: period.elapsed, length: period.length })
            : t('period.closed')
      }
      strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
    />
  );

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // A forecast column: the page is the phone's forecast sheet, opened out (§5.17).
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
        <div className={styles.top}>
          {header}
          <div className={styles.figures}>
            <Figure label={t('stats.incomeAbout')} note={t('stats.fromRecurrences')}>
              <AmountText
                minor={selected.income}
                currency={currency}
                locale={locale}
                size="large"
                positive
              />
            </Figure>
            <Figure
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
                size="large"
              />
            </Figure>
            <Figure label={t('stats.netAbout')}>
              <AmountText
                minor={selected.income - selected.expenses}
                currency={currency}
                locale={locale}
                size="large"
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
                size="large"
              />
            </Figure>
          </div>
          {chart}
        </div>

        <Columns
          lead={
            <div className={styles.sticky}>
              <Section title={t('stats.forecastHowTitle')}>
                <p className={styles.prose}>{t('stats.forecastHow')}</p>
              </Section>

              <Section title={t('stats.forecastPeriods')}>
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
                        <td>{formatMoney(entry.expenses, currency, locale)}</td>
                        <td className={`${styles.faint} ${styles.rangeCol}`}>
                          {t('stats.forecastRange', {
                            min: formatMajor(entry.expensesMin, currency, locale, 'never'),
                            max: formatMajor(entry.expensesMax, currency, locale, 'never'),
                          })}
                        </td>
                        <td>{formatMoney(entry.balance, currency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </div>
          }
          trail={
            <Section
              title={t('stats.forecastRecurrences')}
              trailing={
                <span className={styles.status}>
                  {formatCycleRange(selected.range, locale, today)}
                </span>
              }
            >
              {view.recurrences.length === 0 ? (
                <EmptyState title={t('stats.forecastNoRecurrences')} />
              ) : (
                view.recurrences.map((row) => {
                  const category =
                    row.categoryId === null ? undefined : categories.get(row.categoryId);
                  return (
                    <ListRow
                      key={row.recurrenceId}
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
            </Section>
          }
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────────────────────
  // A running or closed period: what the phone's Statistiche shows, in two columns.
  // ─────────────────────────────────────────────────────────────────────────────────────────────
  const view = statsView({ data: page.data, def, today, period, direction });
  const tagNames = new Map(page.data.tags.map((tag) => [tag.id, tag.name]));
  const anyTagIncome = view.tags.tags.some((row) => row.income > 0);

  const ranked = view.split.rows.map((row, rank) => ({ row, colour: segmentColour(rank) }));
  // Past the fifth the categories share one segment, so the bar keeps as many pieces as it has
  // colours; the rows below still each carry their own amount.
  const segments: SplitSegment[] = [
    ...ranked.slice(0, SPLIT_SEGMENTS).map(({ row, colour }) => ({
      key: row.categoryId,
      amount: row.amount,
      colour,
    })),
    {
      key: 'other',
      amount: ranked.slice(SPLIT_SEGMENTS).reduce((sum, { row }) => sum + row.amount, 0),
      colour: 'var(--color-segment-other)',
    },
  ];

  const projection = view.figures.projection;
  const median = view.figures.median;
  // What the design writes under Uscite: «finora» while the period runs, and how a closed one sat
  // against the median of the six before it.
  const spentNote =
    period.isCurrent || median === null
      ? period.isCurrent
        ? t('stats.soFar')
        : undefined
      : t(view.figures.spent >= median ? 'stats.aboveMedian' : 'stats.belowMedian', {
          amount: formatMoney(Math.abs(view.figures.spent - median), currency, locale),
        });

  const baseHref = periodHref(PATH, period.range, def, today, keep);
  const categoryHref = (categoryId: string) =>
    periodHref(PATH, period.range, def, today, { ...keep, c: categoryId });

  // Every category's panel, rendered here: a click only chooses one (`PanelSwitch`).
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
    panels[`c:${row.categoryId}`] = {
      title: row.category?.name ?? MISSING,
      body: (
        <>
          <Figure
            label={direction === 'income' ? t('stats.income') : t('stats.expenses')}
            note={[
              t('stats.ofTotal', { pct: row.share }),
              row.delta === null
                ? t('stats.newLabel')
                : t('stats.vsUsual', { delta: formatSignedPercent(row.delta) }),
            ].join(' · ')}
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
          <span className={styles.dot} style={{ background: colour }} aria-hidden="true" />
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
        <PageHead
          title={header}
          hero={
            <Figure label={t('stats.expenses')} note={spentNote}>
              <AmountText
                minor={view.figures.spent}
                currency={currency}
                locale={locale}
                size="hero"
              />
            </Figure>
          }
          stats={
            <>
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
                <Figure label={t('stats.projection')}>
                  <AmountText
                    minor={projection}
                    currency={currency}
                    locale={locale}
                    size="headline"
                  />
                </Figure>
              )}
            </>
          }
          aside={
            <ChartFrame
              title={t('stats.cycleTrend')}
              value={
                <AmountText
                  minor={view.figures.spent}
                  currency={currency}
                  locale={locale}
                  size="footnote"
                />
              }
              foot={
                <span>
                  {t('stats.trendFooter', { elapsed: period.elapsed, length: period.length })}
                </span>
              }
            >
              <TrendChart current={view.trend.current} usual={view.trend.usual} height={96} />
            </ChartFrame>
          }
        />

        {chart}

        <Section
          title={t('stats.split')}
          trailing={
            <span className={styles.chips}>
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
          }
        >
          {view.split.rows.length === 0 ? (
            <EmptyState title={t('stats.empty')} />
          ) : (
            <>
              <SplitBar segments={segments} />
              <CardGrid>
                {ranked.map(({ row, colour }) => (
                  <Card
                    key={row.categoryId}
                    href={categoryHref(row.categoryId)}
                    selectId={`c:${row.categoryId}`}
                  >
                    <CardHead
                      leading={
                        row.category === undefined ? undefined : (
                          <IconBox
                            name={row.category.icon as IconName}
                            colorIndex={row.category.colorIndex}
                          />
                        )
                      }
                      name={row.category?.name ?? MISSING}
                      meta={t('targets.percent', { value: row.share })}
                    />
                    <div>
                      <AmountText
                        minor={row.amount}
                        currency={currency}
                        locale={locale}
                        size="large"
                      />
                      <CardNote>
                        {row.delta === null
                          ? t('stats.newLabel')
                          : t('stats.vsUsual', { delta: formatSignedPercent(row.delta) })}
                      </CardNote>
                    </div>
                    <SplitBar
                      segments={[
                        { key: 'share', amount: row.amount, colour },
                        {
                          key: 'rest',
                          amount: Math.max(0, view.split.total - row.amount),
                          colour: 'var(--color-track)',
                        },
                      ]}
                    />
                  </Card>
                ))}
                {/* Quota impegnata leaves its section for a ghost card at the end of the grid (K). */}
                <Card ghost>
                  <CardLabel>{t('stats.committed')}</CardLabel>
                  <span className={styles.percent}>
                    {t('targets.percent', { value: view.committed.share })}
                  </span>
                  <p className={styles.note}>
                    {t('stats.committedLine', {
                      pct: view.committed.share,
                      amount: formatMoney(view.committed.amount, currency, locale),
                    })}
                  </p>
                </Card>
              </CardGrid>
            </>
          )}
          {view.split.excluded.count === 0 ? null : (
            <p className={styles.note}>
              {plural(t, locale, 'stats.excludedRow', view.split.excluded.count, {
                amount: formatMoney(view.split.excluded.amount, currency, locale),
              })}
            </p>
          )}
        </Section>

        <Section
          title={t('stats.tags')}
          trailing={
            <span className={styles.status}>
              {anyTagIncome ? t('stats.tagsFlows') : t('stats.expenses')}
            </span>
          }
        >
          {view.tags.tags.length === 0 ? (
            <EmptyState title={t('stats.tagsEmpty')} />
          ) : (
            view.tags.tags.map((row) => (
              <ListRow
                key={row.tagId}
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
                amount: formatMoney(view.tags.untagged, currency, locale),
              })}
            </p>
          )}
          {view.tags.tags.length < 2 ? null : (
            <p className={styles.footnote}>{t('stats.tagsOverlap')}</p>
          )}
        </Section>
      </div>
    </PanelSwitch>
  );
}
