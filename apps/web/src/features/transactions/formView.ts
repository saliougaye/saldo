import {
  type AccountType,
  accountBalances,
  accountChoices,
  type CurrencyCode,
  childCategories,
  emptyForm,
  formFromTransaction,
  getCurrency,
  isPocket,
  type LocalDate,
  type MinorDigits,
  type TransactionFormValues,
  topCategories,
  topLevelCategories,
  type UserData,
} from '@saldo/core';

export interface FormAccount {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
  type: AccountType;
  pocket: boolean;
  archived: boolean;
  /** Today's balance in minor units, the edited row left out (so the preview does not count it twice). */
  balance: number;
  goalTarget: number | null;
}

export interface FormCategory {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
  direction: 'expense' | 'income';
  child: boolean;
}

export interface FormView {
  mode: 'new' | 'edit';
  id: string | null;
  initial: TransactionFormValues;
  recurring: boolean;
  today: LocalDate;
  minorDigits: MinorDigits;
  accounts: FormAccount[];
  top: { expense: string[]; income: string[] };
  categories: FormCategory[];
  tags: { id: string; name: string }[];
}

/**
 * Everything the web's transaction form reads (§6.16, §17.1.7), computed on the server by the same
 * core functions the phone's form calls, and handed to the client as data.
 */
export function formView(input: {
  data: UserData;
  today: LocalDate;
  currency: CurrencyCode;
  mode: 'new' | 'edit';
  id: string | null;
}): FormView | null {
  const { data, today } = input;
  const { minorDigits } = getCurrency(input.currency);
  const editing =
    input.mode === 'edit' ? data.transactions.find((tx) => tx.id === input.id) : undefined;
  if (input.mode === 'edit' && editing === undefined) return null;

  const others = data.transactions.filter((tx) => tx.id !== editing?.id);
  const balances = accountBalances(data.accounts, others, today);
  const used = new Set([editing?.accountId, editing?.toAccountId]);
  const visible = data.accounts.filter(
    (account) => account.archivedAt === null || used.has(account.id),
  );
  const accounts = accountChoices(visible, {
    includePockets: true,
    keepId: editing?.accountId ?? null,
  }).map(
    (account): FormAccount => ({
      id: account.id,
      name: account.name,
      icon: account.icon,
      colorIndex: account.colorIndex,
      type: account.type,
      pocket: isPocket(account),
      archived: account.archivedAt !== null,
      balance: balances.get(account.id) ?? 0,
      goalTarget: account.goalTarget ?? null,
    }),
  );

  const firstAccount = accounts.find((account) => !account.pocket && !account.archived)?.id ?? null;
  const initial =
    editing === undefined
      ? emptyForm(today, firstAccount)
      : formFromTransaction(editing, minorDigits);

  const categories: FormCategory[] = [];
  for (const direction of ['expense', 'income'] as const) {
    for (const parent of topLevelCategories(data.categories, direction)) {
      categories.push({ ...pick(parent), child: false });
      for (const child of childCategories(data.categories, parent.id)) {
        categories.push({ ...pick(child), child: true });
      }
    }
  }

  const usage = new Map<string, number>();
  for (const tx of data.transactions) {
    for (const id of tx.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  const tags = [...data.tags]
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .map((tag) => ({ id: tag.id, name: tag.name }));

  const upToToday = data.transactions.filter((tx) => tx.date <= today);
  return {
    mode: input.mode,
    id: editing?.id ?? null,
    initial,
    recurring: editing !== undefined && editing.recurrenceId !== null,
    today,
    minorDigits,
    accounts,
    top: {
      expense: topCategories(data.categories, upToToday, 'expense', { today }).map((c) => c.id),
      income: topCategories(data.categories, upToToday, 'income', { today }).map((c) => c.id),
    },
    categories,
    tags,
  };
}

function pick(category: UserData['categories'][number]): Omit<FormCategory, 'child'> {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    colorIndex: category.colorIndex,
    direction: category.direction,
  };
}
