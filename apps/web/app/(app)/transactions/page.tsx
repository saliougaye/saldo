import { formatDayMonth, formatLongDate, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PERIOD_PARAM } from '../../../src/features/period/periodParams';
import type { DetailFactKind } from '../../../src/features/transactions/detailView';
import { detailView } from '../../../src/features/transactions/detailView';
import {
  filtersFromSearch,
  searchFromFilters,
  toggleHref,
} from '../../../src/features/transactions/listParams';
import { type DayView, listView } from '../../../src/features/transactions/listView';
import { plural } from '../../../src/i18n/plural';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { Band } from '../../../src/ui/Band';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { Icon } from '../../../src/ui/Icon';
import { ListRow } from '../../../src/ui/ListRow';
import { Panel } from '../../../src/ui/Panel';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { SearchField } from '../../../src/ui/SearchField';
import { Section } from '../../../src/ui/Section';
import styles from './transactions.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/transactions';

/** The parameter that carries the selected row, and the only state the panel has. */
const SELECTION_PARAM = 't';

/** Which label each fact of the panel takes: the phone's own, key for key (§6.6). */
const FACT_LABELS: Record<DetailFactKind, string> = {
  from: 'txForm.from',
  to: 'txForm.to',
  category: 'transactions.detailCategory',
  account: 'transactions.detailAccount',
  date: 'transactions.detailDate',
  note: 'transactions.detailNote',
};

/**
 * Transazioni on the web (§17.1.7): the period, the search and the chips of §5.12, «In arrivo» as
 * its own section, then one section per day — and the selected row's detail in a trailing panel
 * that the URL, not client state, decides. Every figure comes from `listView` and `detailView`,
 * which are the same `@saldo/core` the phone calls: nothing is added up here.
 */
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, period, params } = page;
  const filters = filtersFromSearch(params);
  const view = listView({
    data: page.data,
    filters,
    today,
    def,
    period,
    kindLabel: (kind) => t(`kinds.${kind}`),
  });
  const selectedId = params[SELECTION_PARAM];
  const selected =
    selectedId === undefined
      ? null
      : detailView({
          data: page.data,
          id: selectedId,
          today,
          kindLabel: (kind) => t(`kinds.${kind}`),
        });

  // What every link on this page carries: the filters, and the period, which is not one of them.
  const keep: Record<string, string> = searchFromFilters(filters);
  const periodParam = params[PERIOD_PARAM];
  if (periodParam !== undefined) keep[PERIOD_PARAM] = periodParam;
  const href = (extra: Record<string, string> = {}) => {
    const query = new URLSearchParams({ ...keep, ...extra }).toString();
    return query === '' ? PATH : `${PATH}?${query}`;
  };
  const keepWithoutQuery = Object.fromEntries(Object.entries(keep).filter(([key]) => key !== 'q'));

  const factLabel = (kind: DetailFactKind) => t(FACT_LABELS[kind]);
  // A figure inside a sentence is plain text; `AmountText` renders the ones that stand alone.
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const filteredTotal = plural(
    t,
    locale,
    view.totals.income > 0 ? 'transactions.filteredTotalMixed' : 'transactions.filteredTotal',
    view.totals.count,
    { spent: money(view.totals.expense), income: money(view.totals.income) },
  );

  const dayRows = (day: DayView, upcoming: boolean) =>
    day.rows.map((row) => (
      <ListRow
        key={row.id}
        href={href({ [SELECTION_PARAM]: row.id })}
        selected={selected?.id === row.id}
        icon={row.icon as IconName}
        colorIndex={row.colorIndex}
        badge={row.recurring ? 'repeat' : undefined}
        title={row.title}
        subtitle={upcoming ? `${formatDayMonth(row.date, locale)} · ${row.subtitle}` : row.subtitle}
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
    ));

  const fact = (key: string, label: string, value: ReactNode) => (
    <div className={styles.fact} key={key}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </div>
  );

  return (
    <div className={styles.layout}>
      <div className={styles.list}>
        <Band>
          <PeriodHeader
            period={period}
            def={def}
            today={today}
            locale={locale}
            path={PATH}
            params={searchFromFilters(filters)}
            strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
          />
          <SearchField
            // The field is uncontrolled once mounted; a query that changed in the URL must reset it.
            key={filters.query}
            path={PATH}
            keep={keepWithoutQuery}
            value={filters.query}
            label={t('common.search')}
            placeholder={t('transactions.searchPlaceholder')}
          />
          <div className={styles.chips}>
            <Chip
              label={t('transactions.onlyExpenses')}
              href={toggleHref(PATH, filters, { direction: 'expense' }, params)}
              active={filters.direction === 'expense'}
            />
            <Chip
              label={t('transactions.onlyIncome')}
              href={toggleHref(PATH, filters, { direction: 'income' }, params)}
              active={filters.direction === 'income'}
            />
            <Chip
              label={t('transactions.onlyTransfers')}
              href={toggleHref(PATH, filters, { direction: 'transfer' }, params)}
              active={filters.direction === 'transfer'}
            />
            {/* Archived accounts are listed too, as on the phone: their rows are still in the
                period, and a filter that cannot reach them hides them for good (§5.12). */}
            {page.data.accounts.map((account) => (
              <Chip
                key={account.id}
                label={account.name}
                href={toggleHref(PATH, filters, { accountId: account.id }, params)}
                active={filters.accountId === account.id}
              />
            ))}
            <Chip
              label={t('transactions.onlyExcluded')}
              href={toggleHref(PATH, filters, { excluded: !filters.onlyExcluded }, params)}
              active={filters.onlyExcluded}
            />
          </div>
          {view.filtered ? <p className={styles.filteredTotal}>{filteredTotal}</p> : null}
        </Band>

        {view.upcoming.count === 0 ? null : (
          <Section
            title={t('transactions.upcoming')}
            trailing={
              <span className={styles.sectionMeta}>
                {plural(t, locale, 'transactions.upcomingCount', view.upcoming.count)}
                <AmountText
                  minor={view.upcoming.net}
                  currency={currency}
                  locale={locale}
                  sign="always"
                  size="footnote"
                />
              </span>
            }
          >
            {view.upcomingDays.flatMap((day) => dayRows(day, true))}
          </Section>
        )}

        {view.days.length === 0 && view.upcomingDays.length === 0 ? (
          <EmptyState
            title={view.filtered ? t('transactions.noResults') : t('transactions.empty')}
            body={view.filtered ? t('transactions.noResultsBody') : t('transactions.emptyBody')}
          />
        ) : (
          view.days.map((day) => (
            <Section
              key={day.date}
              title={formatDayMonth(day.date, locale)}
              trailing={
                <AmountText
                  minor={day.expenseTotal}
                  currency={currency}
                  locale={locale}
                  size="footnote"
                />
              }
            >
              {dayRows(day, false)}
            </Section>
          ))
        )}
      </div>

      {selected === null ? null : (
        <Panel title={selected.title} closeHref={href()} closeLabel={t('common.close')}>
          <div className={styles.amount}>
            <AmountText
              minor={selected.amount.minor}
              currency={currency}
              locale={locale}
              sign={selected.amount.signDisplay}
              muted={selected.amount.muted}
              size="hero"
            />
            <p className={styles.subtitle}>{selected.subtitle}</p>
          </div>

          <dl className={styles.facts}>
            {selected.facts.map((item) =>
              fact(
                item.kind,
                factLabel(item.kind),
                item.kind === 'date' ? (
                  formatLongDate(item.value, locale)
                ) : item.href === null ? (
                  item.value
                ) : (
                  <Link className={styles.factLink} href={item.href}>
                    {item.value}
                  </Link>
                ),
              ),
            )}
            {selected.tagNames.length === 0
              ? null
              : fact('tags', t('transactions.tags'), selected.tagNames.join(' · '))}
            {selected.recurrenceId === null
              ? null
              : fact(
                  'recurrence',
                  t('recurrence.recurringRow'),
                  selected.recurrenceEnd === null
                    ? t('recurrence.noEnd')
                    : t('recurrence.untilDate', {
                        date: formatDayMonth(selected.recurrenceEnd, locale),
                      }),
                )}
          </dl>

          {selected.upcoming ? <p className={styles.note}>{t('transactions.upcoming')}</p> : null}
          {selected.excluded ? (
            <p className={styles.note}>{t('transactions.excludedFromTotals')}</p>
          ) : null}
          {selected.attachmentCount === 0 ? null : (
            <p className={styles.note}>
              {plural(t, locale, 'attachments.countOnPhone', selected.attachmentCount)}
            </p>
          )}

          {/* 0.3e turns this into the form; until then it says so rather than lying (§17.1.9). */}
          <div className={styles.inert}>
            <span className={styles.inertAction}>
              <Icon name="pencil" size={14} />
              {t('common.edit')}
            </span>
            <p className={styles.note}>{t('web.shell.comingIn0_3e')}</p>
          </div>
        </Panel>
      )}
    </div>
  );
}
