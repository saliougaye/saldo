import { addDays, summarizePeriod } from '@saldo/core';
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
import { Card, CardGrid, CardLabel, CardNote } from '../../../src/ui/Card';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FilterMenu } from '../../../src/ui/FilterMenu';
import { Icon } from '../../../src/ui/Icon';
import { ListRow } from '../../../src/ui/ListRow';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { ProgressBar } from '../../../src/ui/ProgressBar';
import { SearchField } from '../../../src/ui/SearchField';
import { Section } from '../../../src/ui/Section';
import { DeleteTransaction } from './DeleteTransaction';
import { TransactionForm } from './TransactionForm';
import { TransactionsPanels } from './TransactionsPanels';
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
 * Transazioni on the web (§17.1.7): the period, the search and the chips of §5.12, «In arrivo» as
 * a disclosure, then one section per day. The selected row's detail is a trailing panel.
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
  // D7: the cards say what the period holds, whatever the filters; the list under them is filtered.
  const summary = summarizePeriod(page.data.transactions, period.range, today);
  const upcomingRows = view.upcomingDays.flatMap((day) => day.rows);
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
          selectId={row.id}
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
          <CardGrid>
            <Card>
              <CardLabel>{t('home.expenses')}</CardLabel>
              <AmountText minor={summary.spent} currency={currency} locale={locale} size="title" />
              <ProgressBar
                thick
                ratio={summary.ratio}
                pace={period.isCurrent ? summary.pace : null}
                tone={summary.overPace ? 'over' : 'normal'}
              />
              <CardNote>
                {period.isCurrent
                  ? t('home.dayOf', { elapsed: period.elapsed, length: period.length })
                  : t('home.closedCycle')}
              </CardNote>
            </Card>
            <Card>
              <CardLabel>{t('home.income')}</CardLabel>
              <AmountText
                minor={summary.income}
                currency={currency}
                locale={locale}
                size="title"
                positive
              />
            </Card>
            <Card>
              <CardLabel>
                {t('home.upcoming')} ·{' '}
                {plural(t, locale, 'home.upcomingCount', view.upcoming.count)}
              </CardLabel>
              <AmountText
                minor={view.upcoming.net}
                currency={currency}
                locale={locale}
                size="title"
                sign="always"
              />
              {/* D12: the next three; the disclosure in the list holds them all. */}
              <div className={styles.cardRows}>
                {upcomingRows.slice(0, 3).map((row) => (
                  <ListRow
                    key={row.id}
                    open
                    href={href({ [SELECTION_PARAM]: row.id })}
                    title={row.title}
                    subtitle={formatDayMonth(row.date, locale)}
                    trailing={
                      <AmountText
                        minor={row.amount.minor}
                        currency={currency}
                        locale={locale}
                        sign={row.amount.signDisplay}
                        size="footnote"
                        muted
                      />
                    }
                  />
                ))}
              </div>
            </Card>
          </CardGrid>
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
                opens with no client state — the phone's `UpcomingRow`. */}
            {view.upcoming.count === 0 ? null : (
              <details className={styles.upcoming} id={UPCOMING_ID}>
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
