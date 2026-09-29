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
  minorToAmountBuffer,
  type TransactionFormValues,
  type TransactionKind,
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
  /** As on the account row: what `fillsFromBalances` reads to leave an archived goal alone. */
  archivedAt: string | null;
  /** Today's balance in minor units, the edited row left out (so the preview does not count it twice). */
  balance: number;
  /**
   * Today's balance over the whole ledger, the edited row still in it: the `now` of
   * `previewFromBalances` (`balance` is its `without`). The same figure as `balance` for a new one.
   */
  balanceNow: number;
  goalTarget: number | null;
}

export interface FormCategory {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
  direction: 'expense' | 'income';
  child: boolean;
  /** Only the edited row's own category can be archived: it keeps it, as on the phone (§5.4). */
  archived: boolean;
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
  /** «Registra la spesa»: saving this expense also closes that goal (§5.14). */
  closeGoalId: string | null;
}

/**
 * What a link may fill in a new form: «Metti da parte» / «Preleva» (`from`, `to`, `description`)
 * and «Registra la spesa» (`closeGoal`, `amount` in minor units). Plain strings, as read from the URL.
 */
export interface FormPrefill {
  from?: string;
  to?: string;
  description?: string;
  closeGoal?: string;
  amount?: string;
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
  prefill?: FormPrefill;
}): FormView | null {
  const { data, today } = input;
  const { minorDigits } = getCurrency(input.currency);
  const editing =
    input.mode === 'edit' ? data.transactions.find((tx) => tx.id === input.id) : undefined;
  if (input.mode === 'edit' && editing === undefined) return null;

  const others = data.transactions.filter((tx) => tx.id !== editing?.id);
  const balances = accountBalances(data.accounts, others, today);
  const balancesNow =
    editing === undefined ? balances : accountBalances(data.accounts, data.transactions, today);
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
      archivedAt: account.archivedAt,
      balance: balances.get(account.id) ?? 0,
      balanceNow: balancesNow.get(account.id) ?? 0,
      goalTarget: account.goalTarget ?? null,
    }),
  );

  const firstAccount = accounts.find((account) => !account.pocket && !account.archived)?.id ?? null;
  const prefilled =
    editing === undefined ? prefillFor(input.prefill, data, accounts, today, minorDigits) : null;
  const initial =
    editing !== undefined
      ? formFromTransaction(editing, minorDigits)
      : (prefilled?.values ?? emptyForm(today, firstAccount));

  const categories: FormCategory[] = [];
  for (const direction of ['expense', 'income'] as const) {
    for (const parent of topLevelCategories(data.categories, direction)) {
      categories.push({ ...pick(parent), child: false });
      for (const child of childCategories(data.categories, parent.id)) {
        categories.push({ ...pick(child), child: true });
      }
    }
    // An archived category the edited row uses stays choosable, last in its direction.
    const own = data.categories.find((category) => category.id === editing?.categoryId);
    if (own !== undefined && own.direction === direction && own.archivedAt !== null) {
      categories.push({ ...pick(own), child: own.parentId !== null });
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
    closeGoalId: prefilled?.closeGoalId ?? null,
  };
}

/**
 * A link's fill, or null when it names nothing usable. An account that is missing, archived or a
 * pocket that is not open is ignored, so the field opens blank rather than on a row the server
 * would refuse.
 */
function prefillFor(
  prefill: FormPrefill | undefined,
  data: UserData,
  accounts: FormAccount[],
  today: LocalDate,
  minorDigits: MinorDigits,
): { values: TransactionFormValues; closeGoalId: string | null } | null {
  if (prefill === undefined) return null;
  const usable = (id: string | undefined): string | null =>
    id !== undefined && accounts.some((account) => account.id === id && !account.archived)
      ? id
      : null;
  const description = prefill.description ?? '';

  const goal = data.accounts.find((account) => account.id === prefill.closeGoal);
  if (goal !== undefined && isPocket(goal) && goal.archivedAt === null) {
    const amount = Number(prefill.amount);
    return {
      closeGoalId: goal.id,
      values: {
        ...emptyForm(today, goal.id),
        kind: 'expense',
        buffer:
          Number.isInteger(amount) && amount > 0 ? minorToAmountBuffer(amount, minorDigits) : '',
        description,
      },
    };
  }

  const from = usable(prefill.from);
  const to = usable(prefill.to);
  const fallback = accounts.find((account) => !account.pocket && !account.archived)?.id ?? null;
  if (from === null && to === null) {
    return { closeGoalId: null, values: { ...emptyForm(today, fallback), description } };
  }
  return {
    closeGoalId: null,
    values: {
      ...emptyForm(today, from ?? fallback),
      kind: 'transfer',
      toAccountId: to,
      description,
    },
  };
}

function pick(category: UserData['categories'][number]): Omit<FormCategory, 'child'> {
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    colorIndex: category.colorIndex,
    direction: category.direction,
    archived: category.archivedAt !== null,
  };
}

/**
 * The accounts the form offers for a kind. Money enters or leaves a pocket only by transfer
 * (§5.14), so an expense or an income lists none — except the pocket the edited row already sits
 * on, the phone's close-goal expense, which the server also accepts (`saveTransaction`).
 */
export function accountsFor(view: FormView, kind: TransactionKind): FormAccount[] {
  if (kind === 'transfer') return view.accounts;
  const own = view.mode === 'edit' ? view.initial.accountId : null;
  return view.accounts.filter((account) => !account.pocket || account.id === own);
}
