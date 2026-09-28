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
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { Band, BandFigure, BandFigures } from '../../../src/ui/Band';
import { Chip } from '../../../src/ui/Chip';
import { Columns } from '../../../src/ui/Columns';
import { CashflowChart } from '../../../src/ui/charts/CashflowChart';
import { SplitBar, type SplitSegment } from '../../../src/ui/charts/SplitBar';
import { TrendChart } from '../../../src/ui/charts/TrendChart';
import { EmptyState } from '../../../src/ui/EmptyState';
import { ListRow } from '../../../src/ui/ListRow';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { Section } from '../../../src/ui/Section';
import styles from './stats.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/stats';

/** Which direction Ripartizione is reading; the phone's segmented control, as two chips. */
const DIRECTION_PARAM = 'direction';

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
    <BandFigure label={label}>
      {children}
      {note === undefined || note === '' ? null : <span className={styles.note}>{note}</span>}
    </BandFigure>
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
        <Band>
          {chart}
          {header}
          <BandFigures>
            <Figure label={t('stats.incomeAbout')} note={t('stats.fromRecurrences')}>
              <AmountText
                minor={selected.income}
                currency={currency}
                locale={locale}
                size="title"
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
                size="title"
              />
            </Figure>
            <Figure label={t('stats.netAbout')}>
              <AmountText
                minor={selected.income - selected.expenses}
                currency={currency}
                locale={locale}
                size="title"
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
                size="title"
              />
            </Figure>
          </BandFigures>
        </Band>

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
                      <th scope="col">{t('stats.forecastColRange')}</th>
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
                        <td className={styles.faint}>
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

  return (
    <div className={styles.page}>
      <Band>
        {chart}
        {header}
        <BandFigures>
          <Figure label={t('stats.income')} note={period.isCurrent ? t('stats.soFar') : undefined}>
            <AmountText
              minor={view.figures.income}
              currency={currency}
              locale={locale}
              size="title"
            />
          </Figure>
          <Figure label={t('stats.expenses')} note={spentNote}>
            <AmountText
              minor={view.figures.spent}
              currency={currency}
              locale={locale}
              size="title"
            />
          </Figure>
          <Figure label={t('stats.net')} note={period.isCurrent ? t('stats.soFar') : undefined}>
            <AmountText
              minor={view.figures.net}
              currency={currency}
              locale={locale}
              size="title"
              sign="always"
            />
          </Figure>
          {projection === null ? (
            <Figure
              label={t('stats.committed')}
              note={t('stats.committedDecided', {
                amount: formatMoney(view.committed.amount, currency, locale),
              })}
            >
              <span className={styles.percent}>{`${view.committed.share}%`}</span>
            </Figure>
          ) : (
            <Figure
              label={t('stats.projection')}
              note={t(
                projection >= (median ?? 0) ? 'stats.projectionAbove' : 'stats.projectionBelow',
                { amount: formatMoney(Math.abs(projection - (median ?? 0)), currency, locale) },
              )}
            >
              <AmountText minor={projection} currency={currency} locale={locale} size="title" />
            </Figure>
          )}
        </BandFigures>
      </Band>

      <Columns
        lead={
          <div className={styles.sticky}>
            <Section title={t('stats.cycleTrend')}>
              <TrendChart current={view.trend.current} usual={view.trend.usual} />
              <p className={styles.note}>
                {t('stats.trendFooter', { elapsed: period.elapsed, length: period.length })}
              </p>
            </Section>

            <Section title={t('stats.committed')}>
              <SplitBar
                segments={[
                  {
                    key: 'committed',
                    amount: view.committed.amount,
                    colour: 'var(--color-bar-grey)',
                  },
                  {
                    key: 'discretionary',
                    amount: view.committed.discretionary,
                    colour: 'var(--color-accent)',
                  },
                ]}
              />
              <p className={styles.note}>
                {t('stats.committedLine', {
                  pct: view.committed.share,
                  amount: formatMoney(view.committed.amount, currency, locale),
                })}
              </p>
            </Section>
          </div>
        }
        trail={
          <>
            <Section title={t('stats.split')}>
              <div className={styles.chips}>
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
              </div>
              {view.split.rows.length === 0 ? (
                <EmptyState title={t('stats.empty')} />
              ) : (
                <>
                  <AmountText
                    minor={view.split.total}
                    currency={currency}
                    locale={locale}
                    size="title"
                  />
                  <SplitBar segments={segments} />
                  {ranked.map(({ row, colour }) => (
                    <ListRow
                      key={row.categoryId}
                      icon={row.category?.icon as IconName | undefined}
                      colorIndex={row.category?.colorIndex}
                      title={row.category?.name ?? MISSING}
                      subtitle={`${
                        row.delta === null ? t('stats.newLabel') : formatSignedPercent(row.delta)
                      } · ${t('stats.ofTotal', { pct: row.share })}`}
                      trailing={
                        <>
                          <span className={styles.dot} style={{ background: colour }} />
                          <AmountText minor={row.amount} currency={currency} locale={locale} />
                        </>
                      }
                    />
                  ))}
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
          </>
        }
      />
    </div>
  );
}
