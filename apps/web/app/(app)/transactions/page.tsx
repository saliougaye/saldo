import { addDays } from '@saldo/core';
import {
  cadenceLabel,
  catalogs,
  endLabel,
  formatDayMonth,
  formatLongDate,
  formatMoney,
  formatMoneyParts,
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
import { formView } from '../../../src/features/transactions/formView';
import {
  filtersFromSearch,
  searchFromFilters,
  toggleHref,
} from '../../../src/features/transactions/listParams';
import { type DayView, filterChoices, listView } from '../../../src/features/transactions/listView';
import {
  EDIT_PARAM,
  NEW_PARAM,
  SELECTION_PARAM,
} from '../../../src/features/transactions/panelState';
import { formMessages } from '../../../src/i18n/formMessages';
import { getDb } from '../../../src/server/db/client';
import { readPage } from '../../../src/server/page/context';
import { loadRow } from '../../../src/server/userData/row';
import { AmountText } from '../../../src/ui/AmountText';
import { Chip } from '../../../src/ui/Chip';
import { EmptyState } from '../../../src/ui/EmptyState';
import { FilterMenu } from '../../../src/ui/FilterMenu';
import { Icon } from '../../../src/ui/Icon';
import { ListRow } from '../../../src/ui/ListRow';
import { PeriodHeader } from '../../../src/ui/PeriodHeader';
import { SearchField } from '../../../src/ui/SearchField';
import { Section } from '../../../src/ui/Section';
import { VisuallyHidden } from '../../../src/ui/VisuallyHidden';
import { DeleteTransaction } from './DeleteTransaction';
import { TransactionForm } from './TransactionForm';
import { type DetailPanel, TransactionsPanels } from './TransactionsPanels';
import styles from './transactions.module.css';
import { UndoToast } from './UndoToast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATH = '/transactions';

/** After a delete the page is `?deleted={id}`, which renders «Annulla» (decision 8). */
const DELETED_PARAM = 'deleted';

/** The DOM id of «In arrivo»'s disclosure: `ListKeys` walks its rows only while it is open. */
const UPCOMING_ID = 'upcoming';

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
  const view = listView({ data: page.data, filters, today, def, period, kindLabel });
  const choices = filterChoices(page.data);
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
  // `new URLSearchParams({ edit: '' })` writes `edit=`: presence is what counts, so `?edit` works too.
  const editForm =
    selectedId !== undefined && params[EDIT_PARAM] !== undefined
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
  // Decision 10: deleting an occurrence of a recurrence says so, as the phone does.
  const recurringIds = new Set(
    page.data.transactions.filter((row) => row.recurrenceId !== null).map((row) => row.id),
  );

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
  const moneyParts = formatMoneyParts(0, currency, locale, 'never');

  /** The detail of one row: what the phone's detail screen shows (§6.6). */
  const detailBody = (detail: DetailView) => (
    <>
      {/* Not the list row's amount on purpose: the phone's detail screen signs a transfer
          `-amount` / `negative` while its list row leaves it unsigned, and the web matches
          the phone screen for screen (see `DetailView.hero`). */}
      <AmountText
        minor={detail.hero.minor}
        currency={currency}
        locale={locale}
        sign={detail.hero.signDisplay}
        size="hero"
      />

      <dl className={styles.facts}>
        {detail.facts.map((item) =>
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
        {fact('note', t('transactions.detailNote'), noteText(detail))}
        {detail.recurrence === null
          ? null
          : fact(
              'recurrence',
              t('recurrence.recurringRow'),
              endLabel(detail.recurrence.endDate, t, locale),
            )}
        {detail.excluded
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
        {detail.tagNames.length === 0
          ? null
          : fact('tags', t('transactions.tags'), detail.tagNames.join(' · '))}
        {detail.attachmentCount === 0
          ? null
          : fact(
              'attachments',
              t('transactions.detailAttachments'),
              plural(t, locale, 'attachments.summary', detail.attachmentCount),
            )}
      </dl>

      <div className={styles.actions}>
        {/* Still a navigation: the edit form is rendered by the server (2026-10-07 plan, decision 4). */}
        <Link
          className={styles.action}
          href={href({ [SELECTION_PARAM]: detail.id, [EDIT_PARAM]: '' })}
          aria-keyshortcuts="e"
        >
          <Icon name="pencil" size={14} />
          {t('common.edit')}
          <span aria-hidden="true">
            <kbd className={styles.kbd}>E</kbd>
          </span>
        </Link>
        <span className={styles.spacer} />
        <DeleteTransaction
          id={detail.id}
          updatedAt={detail.updatedAt}
          deletedHref={href({ [DELETED_PARAM]: detail.id })}
          strings={{
            action: t('common.delete'),
            title: t('transactions.deleteTitle', { name: detail.title }),
            body: t(
              recurringIds.has(detail.id)
                ? 'transactions.deleteRecurringBody'
                : 'transactions.deleteBody',
            ),
            confirm: t('common.delete'),
            cancel: t('common.cancel'),
            busy: t('common.loading'),
            errors: writeErrors,
          }}
        />
      </div>
    </>
  );

  // Every row of the list, and the one the URL selected when the list does not hold it (a link
  // from Home to a row of another period).
  const upcomingIds = view.upcomingDays.flatMap((day) => day.rows.map((row) => row.id));
  const ids = view.days.flatMap((day) => day.rows.map((row) => row.id));
  const listed = [...upcomingIds, ...ids];
  const detailIds =
    selectedId === undefined || listed.includes(selectedId) ? listed : [...listed, selectedId];
  const details: Record<string, DetailPanel> = {};
  for (const id of detailIds) {
    const detail = detailView({ data: page.data, id, kindLabel });
    if (detail !== null) details[id] = { title: detail.title, body: detailBody(detail) };
  }

  const formProps = {
    locale,
    currency,
    decimalSeparator: moneyParts.decimalSeparator,
    symbol: moneyParts.symbol,
    symbolPosition: moneyParts.symbolPosition,
    messages: formMessages(catalogs[locale]),
  };
  // A closing expense ends on Conti, where the goal has just left the list.
  const afterSave = (form: { closeGoalId: string | null }) =>
    form.closeGoalId === null ? href({ [SELECTION_PARAM]: '__ID__' }) : '/accounts';

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
                    closeHref={href({ [SELECTION_PARAM]: editForm.id })}
                    afterSave={afterSave(editForm)}
                  />
                ),
              }
        }
        details={details}
        upcomingIds={upcomingIds}
        ids={ids}
        upcomingDisclosureId={UPCOMING_ID}
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
          restoredHref={href({ [SELECTION_PARAM]: deletedId })}
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
