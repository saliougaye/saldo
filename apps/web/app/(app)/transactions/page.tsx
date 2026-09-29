import { addDays } from '@saldo/core';
import {
  cadenceLabel,
  endLabel,
  formatDayMonth,
  formatLongDate,
  formatMoney,
  formatWeekday,
  plural,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PERIOD_PARAM } from '../../../src/features/period/periodParams';
import {
  type DetailFactKind,
  type DetailView,
  detailView,
} from '../../../src/features/transactions/detailView';
import {
  filtersFromSearch,
  searchFromFilters,
  toggleHref,
} from '../../../src/features/transactions/listParams';
import { type DayView, filterChoices, listView } from '../../../src/features/transactions/listView';
import { readPage } from '../../../src/server/page/context';
import { AmountText } from '../../../src/ui/AmountText';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FilterMenu } from '../../../src/ui/FilterMenu';
import { Icon } from '../../../src/ui/Icon';
import { ListRow } from '../../../src/ui/ListRow';
import { Panel } from '../../../src/ui/Panel';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { SearchField } from '../../../src/ui/SearchField';
import { Section } from '../../../src/ui/Section';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
import styles from './transactions.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/transactions';

/** The parameter that carries the selected row, and the only state the panel has. */
const SELECTION_PARAM = 't';

/** What the phone's detail screen shows for a name that does not resolve. A glyph, not a word. */
const MISSING = '—';

/** Which label each fact of the panel takes: the phone's own, key for key (§6.6). */
const FACT_LABELS: Record<DetailFactKind, string> = {
  from: 'txForm.from',
  to: 'txForm.to',
  category: 'transactions.detailCategory',
  account: 'transactions.detailAccount',
  date: 'transactions.detailDate',
};

/**
 * Transazioni on the web (§17.1.7): the period, the search and the chips of §5.12, «In arrivo» as
 * a disclosure, then one section per day — and the selected row's detail in a trailing panel that
 * the URL, not client state, decides. Every figure comes from `listView` and `detailView`, which
 * are the same `@saldo/core` the phone calls: nothing is added up here.
 */
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await readPage(searchParams);
  const { t, locale, currency, today, def, period, params } = page;
  const filters = filtersFromSearch(params);
  const kindLabel = (kind: string) => t(`kinds.${kind}`);
  const view = listView({ data: page.data, filters, today, def, period, kindLabel });
  const choices = filterChoices(page.data);
  const selectedId = params[SELECTION_PARAM];
  const selected =
    selectedId === undefined ? null : detailView({ data: page.data, id: selectedId, kindLabel });

  // What every link on this page carries: the filters, and the period, which is not one of them.
  const periodOnly: Record<string, string> = {};
  const periodParam = params[PERIOD_PARAM];
  if (periodParam !== undefined) periodOnly[PERIOD_PARAM] = periodParam;
  const keep: Record<string, string> = { ...searchFromFilters(filters), ...periodOnly };
  const link = (query: Record<string, string>) => {
    const search = new URLSearchParams(query).toString();
    return search === '' ? PATH : `${PATH}?${search}`;
  };
  const href = (extra: Record<string, string> = {}) => link({ ...keep, ...extra });
  const keepWithoutQuery = Object.fromEntries(Object.entries(keep).filter(([key]) => key !== 'q'));

  // A figure inside a sentence is plain text; `AmountText` renders the ones that stand alone.
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const filteredTotal = plural(
    t,
    locale,
    view.totals.income > 0 ? 'transactions.filteredTotalMixed' : 'transactions.filteredTotal',
    view.totals.count,
    { spent: money(view.totals.expense), income: money(view.totals.income) },
  );

  const accountLabel =
    choices.accounts.find((account) => account.id === filters.accountId)?.name ??
    t('transactions.account');
  const categoryLabel =
    choices.categories.find((category) => category.id === filters.categoryId)?.name ??
    t('transactions.category');
  const tagLabel =
    filters.tagIds.length === 0
      ? t('transactions.tags')
      : filters.tagIds.length === 1
        ? (choices.tags.find((tag) => tag.id === filters.tagIds[0])?.name ?? t('transactions.tags'))
        : plural(t, locale, 'transactions.tagsCount', filters.tagIds.length);

  /** «Oggi», «Ieri», then the weekday: the day's name in bold, its date after it. */
  const dayTitle = (date: string) => {
    const weekday = formatWeekday(date, locale);
    const name =
      date === today
        ? t('txForm.today')
        : date === addDays(today, -1)
          ? t('txForm.yesterday')
          : weekday.charAt(0).toLocaleUpperCase(locale) + weekday.slice(1);
    return (
      <span className={styles.dayTitle}>
        <b className={styles.dayName}>{name}</b> · {formatDayMonth(date, locale)}
      </span>
    );
  };

  const daySection = (day: DayView, upcoming: boolean) => (
    <Section
      open
      key={day.date}
      title={dayTitle(day.date)}
      trailing={
        <AmountText minor={day.expenseTotal} currency={currency} locale={locale} size="footnote" />
      }
    >
      {day.rows.map((row) => (
        <ListRow
          key={row.id}
          open
          href={href({ [SELECTION_PARAM]: row.id })}
          selected={selected?.id === row.id}
          icon={row.icon as IconName}
          colorIndex={row.colorIndex}
          badge={row.recurring ? 'repeat' : undefined}
          badgeLabel={t('recurrence.recurringRow')}
          title={row.title}
          subtitle={row.subtitle}
          upcoming={upcoming}
          trailing={
            <>
              {row.tagNames.length === 0 ? null : (
                <span className={styles.tags}>
                  {row.tagNames.map((name) => (
                    <span className={styles.pill} key={name}>
                      #{name}
                    </span>
                  ))}
                </span>
              )}
              <AmountText
                minor={row.amount.minor}
                currency={currency}
                locale={locale}
                sign={row.amount.signDisplay}
                muted={row.amount.muted}
              />
            </>
          }
        />
      ))}
    </Section>
  );

  const fact = (key: string, label: string, value: ReactNode) => (
    <div className={styles.fact} key={key}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{value}</dd>
    </div>
  );

  /** The phone's «Nota» row: always there, with what it says when nothing was typed. */
  const noteText = (detail: DetailView) => {
    if (detail.note !== null) return detail.note;
    const { recurrence } = detail;
    if (recurrence === null) return t('transactions.manual');
    return t('recurrence.recurringNote', {
      cadence: cadenceLabel(recurrence, recurrence.startDate, t, locale).toLowerCase(),
    });
  };

  const hasRows = view.days.length > 0 || view.upcomingDays.length > 0;

  return (
    <div className={styles.layout} data-panel={selected === null ? undefined : ''}>
      <div className={styles.list}>
        <div className={styles.head}>
          <PeriodHeader
            period={period}
            def={def}
            today={today}
            locale={locale}
            path={PATH}
            params={searchFromFilters(filters)}
            status={plural(t, locale, 'transactions.periodCount', view.totals.count)}
            strings={{ previous: t('web.shell.previousPeriod'), next: t('web.shell.nextPeriod') }}
          />
          <div className={styles.filters}>
            <SearchField
              // The field is uncontrolled once mounted; a query that changed in the URL must reset it.
              key={filters.query}
              path={PATH}
              keep={keepWithoutQuery}
              value={filters.query}
              label={t('common.search')}
              placeholder={t('transactions.searchPlaceholder')}
            />
            {/* The phone's account, category and tag sheets, as menus on the chips that open them (§5.12, §6.23). */}
            <FilterMenu
              label={accountLabel}
              active={filters.accountId !== null}
              options={choices.accounts.map((account) => ({
                key: account.id,
                label: account.archived
                  ? `${account.name} · ${t('accounts.archivedBadge')}`
                  : account.name,
                href: toggleHref(PATH, filters, { accountId: account.id }, params),
                selected: filters.accountId === account.id,
              }))}
            />
            <FilterMenu
              label={categoryLabel}
              active={filters.categoryId !== null}
              options={choices.categories.map((category) => ({
                key: category.id,
                label: category.child ? `— ${category.name}` : category.name,
                href: toggleHref(PATH, filters, { categoryId: category.id }, params),
                selected: filters.categoryId === category.id,
              }))}
            />
            {choices.tags.length === 0 ? null : (
              <FilterMenu
                label={tagLabel}
                active={filters.tagIds.length > 0}
                options={choices.tags.map((tag) => ({
                  key: tag.id,
                  label: tag.name,
                  href: toggleHref(PATH, filters, { tagId: tag.id }, params),
                  selected: filters.tagIds.includes(tag.id),
                }))}
              />
            )}
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
            <Chip
              label={t('transactions.onlyExcluded')}
              href={toggleHref(PATH, filters, { excluded: !filters.onlyExcluded }, params)}
              active={filters.onlyExcluded}
            />
          </div>
          {view.hiddenTransfers === 0 ? null : (
            <p className={styles.filterNote}>
              {plural(t, locale, 'transactions.transfersHidden', view.hiddenTransfers)}
            </p>
          )}
          {view.filtered ? <p className={styles.filterNote}>{filteredTotal}</p> : null}
        </div>

        {!hasRows ? (
          view.filtered ? (
            <div className={styles.empty}>
              <EmptyState
                title={t('transactions.noResults')}
                body={t('transactions.noResultsBody')}
              />
              <Link className={styles.reset} href={link(periodOnly)}>
                {t('transactions.resetFilters')}
              </Link>
            </div>
          ) : (
            <EmptyState title={t('transactions.empty')} body={t('transactions.emptyBody')} />
          )
        ) : (
          <>
            {/* §5.12: what is still to come is folded behind one row. A native disclosure, so it
                opens with no client state and without JavaScript — the phone's `UpcomingRow`. */}
            {view.upcoming.count === 0 ? null : (
              <details className={styles.upcoming}>
                <summary className={styles.upcomingSummary}>
                  <Icon name="clock" size={16} className={styles.upcomingIcon} />
                  <span className={styles.upcomingText}>
                    <b className={styles.upcomingTitle}>{t('transactions.upcoming')}</b> ·{' '}
                    {plural(t, locale, 'transactions.upcomingCount', view.upcoming.count)}
                  </span>
                  <span className={styles.upcomingShow}>{t('transactions.showUpcoming')}</span>
                  <Icon name="chevD" size={16} className={styles.chevron} />
                </summary>
                <div className={styles.upcomingBody}>
                  <p className={styles.divider}>{t('transactions.upcomingSection')}</p>
                  {view.upcomingDays.map((day) => daySection(day, true))}
                </div>
              </details>
            )}
            {/* Shown by CSS only while the disclosure is open, as the phone shows it (§5.12). */}
            {view.upcoming.count > 0 && view.days.length > 0 ? (
              <p className={`${styles.divider} ${styles.settledDivider}`}>
                {t('transactions.settledSection')}
              </p>
            ) : null}
            {view.days.map((day) => daySection(day, false))}
          </>
        )}
      </div>

      {selected === null ? null : (
        <Panel title={selected.title} closeHref={href()} closeLabel={t('common.close')}>
          {/* Not the list row's amount on purpose: the phone's detail screen signs a transfer
              `-amount` / `negative` while its list row leaves it unsigned, and the web matches
              the phone screen for screen (see `DetailView.hero`). */}
          <AmountText
            minor={selected.hero.minor}
            currency={currency}
            locale={locale}
            sign={selected.hero.signDisplay}
            size="hero"
          />

          <dl className={styles.facts}>
            {selected.facts.map((item) =>
              fact(
                item.kind,
                t(FACT_LABELS[item.kind]),
                item.value === null ? (
                  MISSING
                ) : item.kind === 'date' ? (
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
            {fact('note', t('transactions.detailNote'), noteText(selected))}
            {selected.recurrence === null
              ? null
              : fact(
                  'recurrence',
                  t('recurrence.recurringRow'),
                  endLabel(selected.recurrence.endDate, t, locale),
                )}
            {selected.excluded
              ? fact(
                  'excluded',
                  t('transactions.excludedFromTotals'),
                  // The tick is the whole value, and `Icon` is always `aria-hidden`: without the
                  // word beside it a screen reader reads the label and then silence.
                  <>
                    <Icon name="check" size={16} />
                    <VisuallyHidden>{t('common.yes')}</VisuallyHidden>
                  </>,
                )
              : null}
            {selected.tagNames.length === 0
              ? null
              : fact('tags', t('transactions.tags'), selected.tagNames.join(' · '))}
            {selected.attachmentCount === 0
              ? null
              : fact(
                  'attachments',
                  t('transactions.detailAttachments'),
                  plural(t, locale, 'attachments.summary', selected.attachmentCount),
                )}
          </dl>

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
