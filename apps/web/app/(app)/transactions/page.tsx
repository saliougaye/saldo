import { addDays, countsInTotals, isWithin, summarizePeriod } from '@saldo/core';
import {
  catalogs,
  formatDayMonth,
  formatMoney,
  formatMoneyParts,
  formatWeekday,
  plural,
} from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { PERIOD_PARAM } from '../../../src/features/period/periodParams';
import { detailView } from '../../../src/features/transactions/detailView';
import { formView } from '../../../src/features/transactions/formView';
import {
  filtersFromSearch,
  searchFromFilters,
  toggleHref,
} from '../../../src/features/transactions/listParams';
import { type DayView, filterChoices, listView } from '../../../src/features/transactions/listView';
import { NEW_PARAM, SELECTION_PARAM } from '../../../src/features/transactions/panelState';
import { formMessages } from '../../../src/i18n/formMessages';
import { getDb } from '../../../src/server/db/client';
import { readPage } from '../../../src/server/page/context';
import { loadRow } from '../../../src/server/userData/row';
import { AmountText } from '../../../src/ui/AmountText';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FilterMenu } from '../../../src/ui/FilterMenu';
import { Icon } from '../../../src/ui/Icon';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { SearchField } from '../../../src/ui/SearchField';
import { DeleteTransaction } from './DeleteTransaction';
import { TransactionForm } from './TransactionForm';
import { TransactionsPanels } from './TransactionsPanels';
import { TxRow } from './TxRow';
import styles from './transactions.module.css';
import { UndoToast } from './UndoToast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/transactions';

/** After a delete the page is `?deleted={id}`, which renders «Annulla» (decision 8). */
const DELETED_PARAM = 'deleted';

/** The DOM id of «In arrivo»'s disclosure. The arrows skip its rows while it is closed. */
const UPCOMING_ID = 'upcoming';

/**
 * Transazioni on the web (§17.1.7, W5): the period, a summary of three cells, the tool row of
 * §5.12, then one list block: «In arrivo» as a disclosure, then one section per day. The selected row's detail is a trailing panel.
 * `TransactionsPanels` opens it in place, with the URL as its state. Every figure comes from
 * `listView` and `detailView`, which are the same `@saldo/core` the phone calls: nothing is added
 * up here.
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
  const view = listView({ data: page.data, filters, today, period, kindLabel });
  const choices = filterChoices(page.data);
  // D7: the summary says what the period holds, whatever the filters; the list under it is filtered.
  const summary = summarizePeriod(page.data.transactions, period.range, today);

  // W5: the note under Income counts the rows the figure above it adds up.
  const incomeCount = page.data.transactions.filter(
    (tx) => tx.kind === 'income' && isWithin(period.range, tx.date) && countsInTotals(tx, today),
  ).length;
  // The page opened with a panel (a reload, a link from Home): the server renders it. Opened on the
  // page, a panel is the client's (`TransactionsPanels`), and the URL follows it.
  const selectedId = params[SELECTION_PARAM];
  const creating = params[NEW_PARAM] !== undefined;
  // «Metti da parte», «Preleva» and «Registra la spesa» fill a new form from the URL.
  const newForm = formView({
    data: page.data,
    today,
    currency,
    mode: 'new',
    id: null,
    prefill: creating
      ? {
          from: params.from,
          to: params.to,
          description: params.description,
          closeGoal: params.closeGoal,
          amount: params.amount,
        }
      : undefined,
  });
  // W3: `?t={id}` is the row's edit form. `?new` wins, as `panelFromSearch` reads it.
  const editForm =
    selectedId !== undefined && !creating
      ? formView({ data: page.data, today, currency, mode: 'edit', id: selectedId })
      : null;

  // «Annulla» only for a tombstone of this user: a stale or forged `?deleted=` shows nothing.
  const deletedId = params[DELETED_PARAM];
  const deleted =
    deletedId === undefined ? null : await loadRow(getDb(), page.user.id, 'transaction', deletedId);
  const undoTitle =
    deletedId === undefined || deleted === null || deleted.status !== 'found' || !deleted.deleted
      ? null
      : (detailView({
          data: { ...page.data, transactions: [deleted.row] },
          id: deletedId,
          kindLabel,
        })?.title ?? null);
  // What a refused delete or «Annulla» says: the form's own sentences for the same `WriteError`s.
  const writeErrors = {
    invalid: t('web.form.error_invalid'),
    notFound: t('web.form.error_notFound'),
    closedGoal: t('web.form.error_closedGoal'),
    conflict: t('web.form.error_conflict'),
    unexpected: t('web.form.error_unexpected'),
  };
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

  // «59% of income spent · day 13 of 30»: the share of income, then where the period is.
  const periodNote = period.isCurrent
    ? t('home.dayOf', { elapsed: period.elapsed, length: period.length })
    : t('home.closedCycle');
  const expenseNote =
    summary.income > 0
      ? `${t('home.spentOfIncome', {
          percent: t('targets.percent', { value: Math.round(summary.ratio * 100) }),
        })} · ${periodNote}`
      : periodNote;

  // «More»: the three filters the tool row does not show; the label names the one that is on.
  const moreLabel =
    filters.direction === 'income'
      ? t('transactions.onlyIncome')
      : filters.direction === 'transfer'
        ? t('transactions.onlyTransfers')
        : filters.onlyExcluded
          ? t('transactions.onlyExcluded')
          : t('transactions.moreFilters');

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

  // W5: one day of the list — its date and its expenses, then its rows. A `section` with an
  // `h2`, and the head first: the e2e helpers (`sectionOf`, `:scope > div`) read the day so.
  const daySection = (day: DayView, upcoming: boolean) => (
    <section className={styles.day} key={day.date}>
      <div className={styles.dayHead}>
        <h2 className={styles.dayHeading}>{dayTitle(day.date)}</h2>
        <AmountText
          minor={day.expenseTotal}
          currency={currency}
          locale={locale}
          size="footnote"
          muted
        />
      </div>
      {day.rows.map((row) => (
        <TxRow
          key={row.id}
          id={row.id}
          href={href({ [SELECTION_PARAM]: row.id })}
          icon={row.icon as IconName}
          colorIndex={row.colorIndex}
          title={row.title}
          // With a tag filter on, `listView` already puts the tags in place of the category.
          subtitle={
            filters.tagIds.length > 0
              ? row.subtitle
              : [row.subtitle, ...row.tagNames.map((name) => `#${name}`)].join(' · ')
          }
          recurring={row.recurring}
          recurringLabel={t('recurrence.recurringRow')}
          upcoming={upcoming}
          amount={
            <AmountText
              minor={row.amount.minor}
              currency={currency}
              locale={locale}
              sign={row.amount.signDisplay}
              muted={upcoming || row.amount.muted}
            />
          }
        />
      ))}
    </section>
  );

  const hasRows = view.days.length > 0 || view.upcomingDays.length > 0;
  const moneyParts = formatMoneyParts(0, currency, locale, 'never');

  const formProps = {
    locale,
    currency,
    decimalSeparator: moneyParts.decimalSeparator,
    symbol: moneyParts.symbol,
    symbolPosition: moneyParts.symbolPosition,
    messages: formMessages(catalogs[locale]),
  };
  // Save closes the dialog: the list (W3). A closing expense ends on Conti, where the goal has just
  // left the list.
  const afterSave = (form: { closeGoalId: string | null }) =>
    form.closeGoalId === null ? href() : '/accounts';

  return (
    <>
      <TransactionsPanels
        baseHref={href()}
        newTitle={t('txForm.newTitle')}
        editTitle={t('txForm.editTitle')}
        closeLabel={t('common.close')}
        newForm={
          newForm === null ? null : (
            <TransactionForm
              // The form waits hidden between openings: other initial values (a prefill, a new
              // day) are a new form, not the old draft.
              key={JSON.stringify([newForm.initial, newForm.closeGoalId])}
              view={newForm}
              {...formProps}
              closeHref={href()}
              afterSave={afterSave(newForm)}
            />
          )
        }
        edit={
          editForm === null || editForm.id === null
            ? null
            : {
                id: editForm.id,
                form: (
                  <TransactionForm
                    key={`edit:${editForm.id}`}
                    view={editForm}
                    {...formProps}
                    closeHref={href()}
                    afterSave={afterSave(editForm)}
                    deleteControl={
                      editForm.updatedAt === null ? undefined : (
                        <DeleteTransaction
                          id={editForm.id}
                          updatedAt={editForm.updatedAt}
                          deletedHref={href({ [DELETED_PARAM]: editForm.id })}
                          strings={{
                            action: t('common.delete'),
                            busy: t('common.loading'),
                            errors: writeErrors,
                          }}
                        />
                      )
                    }
                  />
                ),
              }
        }
      >
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

          {/* W5: one block in three cells. The figures are the period's, whatever the filters. */}
          <section className={styles.summary} aria-label={t('transactions.summaryLabel')}>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('home.expenses')}</span>
              <AmountText minor={summary.spent} currency={currency} locale={locale} size="title" />
              <ProgressBar
                ratio={summary.ratio}
                pace={period.isCurrent ? summary.pace : null}
                tone={summary.overPace ? 'over' : 'normal'}
              />
              <span className={styles.cellNote}>{expenseNote}</span>
            </div>
            <div className={styles.cell}>
              <span className={styles.cellLabel}>{t('home.income')}</span>
              <AmountText
                minor={summary.income}
                currency={currency}
                locale={locale}
                size="title"
                positive
              />
              <span className={styles.cellNote}>
                {plural(t, locale, 'transactions.periodCount', incomeCount)}
              </span>
            </div>
            {period.isCurrent ? (
              <div className={styles.cell}>
                <span className={styles.cellLabel}>{t('home.upcoming')}</span>
                <AmountText
                  minor={view.upcoming.net}
                  currency={currency}
                  locale={locale}
                  size="title"
                  sign="always"
                />
                <span className={styles.cellNote}>
                  {plural(t, locale, 'transactions.upcomingCount', view.upcoming.count)}
                </span>
              </div>
            ) : null}
          </section>

          {/* W5: the search, the three menus, «Expenses only» and «More». */}
          <div className={styles.tools}>
            <SearchField
              // The field is uncontrolled once mounted; a query that changed in the URL must reset it.
              key={filters.query}
              path={PATH}
              keep={keepWithoutQuery}
              value={filters.query}
              label={t('common.search')}
              placeholder={t('transactions.searchPlaceholder')}
            />
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
            <FilterMenu
              label={moreLabel}
              active={
                filters.direction === 'income' ||
                filters.direction === 'transfer' ||
                filters.onlyExcluded
              }
              options={[
                {
                  key: 'income',
                  label: t('transactions.onlyIncome'),
                  href: toggleHref(PATH, filters, { direction: 'income' }, params),
                  selected: filters.direction === 'income',
                },
                {
                  key: 'transfer',
                  label: t('transactions.onlyTransfers'),
                  href: toggleHref(PATH, filters, { direction: 'transfer' }, params),
                  selected: filters.direction === 'transfer',
                },
                {
                  key: 'excluded',
                  label: t('transactions.onlyExcluded'),
                  href: toggleHref(PATH, filters, { excluded: !filters.onlyExcluded }, params),
                  selected: filters.onlyExcluded,
                },
              ]}
            />
          </div>

          {/* W5: with a filter on, one line: the count, what it spent, and the way back. */}
          {view.filtered && hasRows ? (
            <p className={styles.filterLine}>
              <span>{filteredTotal}</span>
              <Link className={styles.reset} href={link(periodOnly)}>
                {t('transactions.resetFilters')}
              </Link>
            </p>
          ) : null}
          {view.hiddenTransfers === 0 ? null : (
            <p className={styles.filterNote}>
              {plural(t, locale, 'transactions.transfersHidden', view.hiddenTransfers)}
            </p>
          )}
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
          <div className={styles.listBox}>
            {/* §5.12: what is still to come is one closed row at the top (W5). A native
                disclosure, so it opens with no client state. */}
            {view.upcoming.count === 0 ? null : (
              <details className={styles.upcoming} id={UPCOMING_ID}>
                <summary className={styles.upcomingSummary}>
                  <Icon name="chevR" size={16} className={styles.chevron} />
                  <span className={styles.upcomingText}>
                    <b className={styles.upcomingTitle}>{t('transactions.upcoming')}</b>
                    <span>
                      {plural(t, locale, 'transactions.upcomingCount', view.upcoming.count)}
                    </span>
                  </span>
                  <AmountText
                    minor={view.upcoming.net}
                    currency={currency}
                    locale={locale}
                    sign="always"
                    muted
                  />
                </summary>
                <div className={styles.upcomingBody}>
                  {view.upcomingDays.map((day) => daySection(day, true))}
                </div>
              </details>
            )}
            {view.days.map((day) => daySection(day, false))}
            {/* W5: the keys of the list. Shown with a mouse only; a screen reader has its own. */}
            <p className={styles.keys} aria-hidden="true">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> {t('transactions.keysMove')}
              </span>
              <span>
                <kbd>↵</kbd> {t('transactions.keysOpen')}
              </span>
              <span>
                <kbd>N</kbd> {t('transactions.keysNew')}
              </span>
              <span>
                <kbd>/</kbd> {t('transactions.keysSearch')}
              </span>
            </p>
          </div>
        )}
      </TransactionsPanels>

      {deletedId === undefined || undoTitle === null ? null : (
        <UndoToast
          // A second delete is a new toast, with its own five seconds.
          key={deletedId}
          id={deletedId}
          restoredHref={href()}
          withoutDeletedHref={href()}
          strings={{
            message: t('transactions.deleted', { name: undoTitle }),
            undo: t('common.undo'),
            errors: writeErrors,
          }}
        />
      )}
    </>
  );
}
