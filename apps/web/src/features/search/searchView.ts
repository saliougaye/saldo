import {
  accountBalances,
  bankBalance,
  type CurrencyCode,
  getCurrency,
  isPocket,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  rankSearch,
  SEARCH_GROUP_LIMIT,
  type SearchEntry,
  transactionRow,
  type UserData,
} from '@saldo/core';
import { type AppLocale, formatDayMonth, formatMoney } from '@saldo/i18n/format';
import type { Translate } from '@saldo/i18n/translate';
import { ICON_NAMES } from '@saldo/ui';
import { periodHref } from '../period/periodParams';

export type SearchKind = 'account' | 'goal' | 'budget' | 'category' | 'tag' | 'transaction';

/** One row of the palette: what it shows, and where it goes. Only what the row draws. */
export interface SearchHit {
  id: string;
  title: string;
  detail: string | null;
  figure: string | null;
  icon: string;
  href: string;
}

export interface SearchGroup {
  key: SearchKind;
  label: string;
  hits: SearchHit[];
}

export interface SearchResult {
  /** The query this answers: the palette drops an answer to a query that is no longer typed. */
  query: string;
  groups: SearchGroup[];
  /** The last row: the Transactions list with the same query, which searches more fields. */
  seeAll: { label: string; href: string };
  /** «Nothing matches …», for the palette to show when no command matches either. */
  noMatch: string;
}

const ICONS: ReadonlySet<string> = new Set(ICON_NAMES);

/** A stored icon name the design set no longer has must not break the row. */
function iconOr(name: string, fallback: string): string {
  return ICONS.has(name) ? name : fallback;
}

/**
 * Palette spec §03: the user's own items and transactions that match `query`, in groups of at most
 * `SEARCH_GROUP_LIMIT` rows, in a fixed order. Archived accounts, goals and categories stay out.
 * A transaction is found by the title its row shows and by its amount.
 */
export function searchView(input: {
  data: UserData;
  query: string;
  today: LocalDate;
  def: PeriodDef;
  currency: CurrencyCode;
  locale: AppLocale;
  t: Translate;
}): SearchResult {
  const { data, today, def, currency, locale, t } = input;
  const query = input.query.trim();
  const seeAll = {
    label: t('web.search.seeAll', { query }),
    href: `/transactions?${new URLSearchParams({ q: query }).toString()}`,
  };
  const noMatch = t('web.search.noResults', { query });
  if (query === '') return { query, groups: [], seeAll, noMatch };

  const minorDigits = getCurrency(currency).minorDigits;
  const rank = <T>(entries: SearchEntry<T>[]): T[] =>
    rankSearch(query, entries, { minorDigits, limit: SEARCH_GROUP_LIMIT });
  const money = (minor: number) => formatMoney(minor, currency, locale);
  const names = new Map(data.accounts.map((account) => [account.id, account.name]));
  const live = data.accounts.filter((account) => account.archivedAt === null);
  const balances = accountBalances(data.accounts, data.transactions, today);

  const accounts = rank(
    live
      .filter((account) => !isPocket(account))
      .map((account) => ({ value: account, text: account.name })),
  ).map((account) => ({
    id: account.id,
    title: account.name,
    detail: t(`accountTypes.${account.type}`),
    figure: money(bankBalance(data.accounts, balances, account.id)),
    icon: iconOr(account.icon, 'wallet'),
    href: `/accounts?a=${encodeURIComponent(account.id)}`,
  }));

  const goals = rank(live.filter(isPocket).map((goal) => ({ value: goal, text: goal.name }))).map(
    (goal) => ({
      id: goal.id,
      title: goal.name,
      detail: names.get(goal.parentAccountId ?? '') ?? null,
      figure: typeof goal.goalTarget === 'number' ? money(goal.goalTarget) : null,
      icon: iconOr(goal.icon, 'piggy'),
      href: `/accounts?g=${encodeURIComponent(goal.id)}`,
    }),
  );

  const budgets = rank(data.budgets.map((budget) => ({ value: budget, text: budget.name }))).map(
    (budget) => ({
      id: budget.id,
      title: budget.name,
      detail: null,
      figure: money(budget.amount),
      icon: iconOr(budget.icon, 'target'),
      href: `/profile/budgets?b=${encodeURIComponent(budget.id)}`,
    }),
  );

  const categoryById = new Map(data.categories.map((category) => [category.id, category]));
  const categories = rank(
    data.categories
      .filter((category) => category.archivedAt === null)
      .map((category) => ({ value: category, text: category.name })),
  ).map((category) => ({
    id: category.id,
    title: category.name,
    detail:
      category.parentId === null
        ? t(`kinds.${category.direction}`)
        : (categoryById.get(category.parentId)?.name ?? null),
    figure: null,
    icon: iconOr(category.icon, 'tag'),
    href: `/profile/categories?c=${encodeURIComponent(category.id)}`,
  }));

  const tags = rank(data.tags.map((tag) => ({ value: tag, text: tag.name }))).map((tag) => ({
    id: tag.id,
    title: `#${tag.name}`,
    detail: null,
    figure: null,
    icon: 'tag',
    href: `/profile/tags?tag=${encodeURIComponent(tag.id)}`,
  }));

  const rows = data.transactions.map((tx) => ({
    tx,
    row: transactionRow(tx, {
      category: (id) => categoryById.get(id),
      accountName: (id) => names.get(id) ?? '',
      kindLabel: (kind) => t(`kinds.${kind}`),
      viewpointAccountId: null,
    }),
  }));
  const transactions = rank(
    rows.map((item) => ({
      value: item,
      text: item.row.title,
      amount: item.tx.amount,
      date: item.tx.date,
    })),
  ).map(({ tx, row }) => ({
    id: tx.id,
    title: row.title,
    detail: `${formatDayMonth(tx.date, locale)} · ${row.subtitle}`,
    figure: formatMoney(row.amount.minor, currency, locale, row.amount.signDisplay),
    icon: iconOr(row.icon, 'tag'),
    href: periodHref('/transactions', periodContaining(def, tx.date), def, today, { t: tx.id }),
  }));

  const groups: SearchGroup[] = [
    { key: 'account' as const, label: t('accounts.title'), hits: accounts },
    { key: 'goal' as const, label: t('goals.title'), hits: goals },
    { key: 'budget' as const, label: t('budgets.title'), hits: budgets },
    { key: 'category' as const, label: t('categories.title'), hits: categories },
    { key: 'tag' as const, label: t('tags.title'), hits: tags },
    { key: 'transaction' as const, label: t('transactions.title'), hits: transactions },
  ].filter((group) => group.hits.length > 0);
  return { query, groups, seeAll, noMatch };
}
