import type { Category, Transaction } from '@saldo/core';
import {
  canCreateTag,
  canSave,
  changeKind,
  dateChoices,
  emptyForm,
  formFromTransaction,
  missingForSave,
  type TransactionFormValues,
  tagSuggestions,
  topCategories,
  toTransactionInput,
} from './useTransactionForm';

const TODAY = '2026-04-18';

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name: id,
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    colorIndex: 0,
    archivedAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

const valid: TransactionFormValues = {
  ...emptyForm(TODAY, 'acc-1'),
  buffer: '45',
  categoryId: 'cat-1',
};

describe('canSave', () => {
  it('needs an amount above zero', () => {
    expect(canSave(valid, 2)).toBe(true);
    expect(canSave({ ...valid, buffer: '' }, 2)).toBe(false);
    expect(canSave({ ...valid, buffer: '0' }, 2)).toBe(false);
    expect(canSave({ ...valid, buffer: '0.00' }, 2)).toBe(false);
  });

  it('needs an account', () => {
    expect(canSave({ ...valid, accountId: null }, 2)).toBe(false);
  });

  it('needs a category unless it is a transfer', () => {
    expect(canSave({ ...valid, categoryId: null }, 2)).toBe(false);
    expect(canSave({ ...valid, kind: 'transfer', categoryId: null, toAccountId: 'acc-2' }, 2)).toBe(
      true,
    );
  });

  it('needs a transfer to go somewhere else', () => {
    const transfer: TransactionFormValues = {
      ...valid,
      kind: 'transfer',
      categoryId: null,
      toAccountId: null,
    };
    expect(canSave(transfer, 2)).toBe(false);
    expect(canSave({ ...transfer, toAccountId: 'acc-1' }, 2)).toBe(false);
    expect(canSave({ ...transfer, toAccountId: 'acc-2' }, 2)).toBe(true);
  });

  it('reads the amount at the currency scale', () => {
    // "0.5" is 50 cents at scale 2 but rounds to nothing at scale 0.
    expect(canSave({ ...valid, buffer: '0.5' }, 2)).toBe(true);
    expect(canSave({ ...valid, buffer: '0.5' }, 0)).toBe(false);
  });
});

describe('changeKind', () => {
  it('clears the field the new kind cannot hold', () => {
    const transfer = changeKind({ ...valid, toAccountId: 'acc-2' }, 'transfer');
    expect(transfer.categoryId).toBeNull();
    const expense = changeKind({ ...valid, kind: 'transfer', toAccountId: 'acc-2' }, 'expense');
    expect(expense.toAccountId).toBeNull();
  });
});

describe('toTransactionInput', () => {
  it('keeps the schema invariant for an expense', () => {
    const input = toTransactionInput(valid, 2);
    expect(input).toMatchObject({
      kind: 'expense',
      amount: 4500,
      toAccountId: null,
      categoryId: 'cat-1',
      note: null,
    });
  });

  it('keeps the schema invariant for a transfer', () => {
    const input = toTransactionInput(
      { ...valid, kind: 'transfer', categoryId: 'cat-1', toAccountId: 'acc-2' },
      2,
    );
    expect(input.categoryId).toBeNull();
    expect(input.toAccountId).toBe('acc-2');
  });

  it('trims the description', () => {
    expect(toTransactionInput({ ...valid, description: '  Bar  ' }, 2).description).toBe('Bar');
  });
});

describe('formFromTransaction', () => {
  it('round-trips an amount through the buffer', () => {
    const transaction = {
      ...toTransactionInput(valid, 2),
      id: 't1',
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '001775000000000-0000-dev',
      deletedAt: null,
      recurrenceId: null,
    } satisfies Transaction;
    const form = formFromTransaction(transaction, 2);
    expect(form.buffer).toBe('45');
    expect(form.repeat).toBe(false);
    expect(toTransactionInput(form, 2).amount).toBe(4500);
  });

  it('marks an occurrence as repeating', () => {
    const transaction = {
      ...toTransactionInput(valid, 2),
      id: 'rec:2026-04-18',
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '001775000000000-0000-dev',
      deletedAt: null,
      recurrenceId: 'rec',
    } satisfies Transaction;
    expect(formFromTransaction(transaction, 2).repeat).toBe(true);
  });
});

describe('dateChoices', () => {
  it('offers today and yesterday', () => {
    expect(dateChoices(TODAY)).toEqual([
      { key: 'today', date: '2026-04-18' },
      { key: 'yesterday', date: '2026-04-17' },
    ]);
  });
});

describe('topCategories', () => {
  const categories = [
    category('cat-rare', { sortOrder: 0 }),
    category('cat-often', { sortOrder: 1 }),
    category('cat-income', { direction: 'income', sortOrder: 2 }),
    category('cat-archived', { archivedAt: '2026-01-01T00:00:00.000Z', sortOrder: 3 }),
  ];
  const usage = [
    { categoryId: 'cat-often' },
    { categoryId: 'cat-often' },
    { categoryId: 'cat-rare' },
  ];

  it('orders by usage, then by the manual order', () => {
    expect(topCategories(categories, usage, 'expense').map((c) => c.id)).toEqual([
      'cat-often',
      'cat-rare',
    ]);
  });

  it('shows income categories for income', () => {
    expect(topCategories(categories, usage, 'income').map((c) => c.id)).toEqual(['cat-income']);
  });

  it('hides archived categories', () => {
    expect(topCategories(categories, usage, 'expense').map((c) => c.id)).not.toContain(
      'cat-archived',
    );
  });

  it('caps the grid at two rows, the "Altro" tile included', () => {
    const many = Array.from({ length: 20 }, (_, index) => category(`c${index}`));
    expect(topCategories(many, [], 'expense')).toHaveLength(7);
  });
});

describe('tagSuggestions / canCreateTag', () => {
  const tags = [
    { id: 't-work', name: 'Lavoro' },
    { id: 't-holiday', name: 'Vacanza' },
    { id: 't-gift', name: 'Regalo' },
  ];
  const usage = [{ tagIds: ['t-holiday'] }, { tagIds: ['t-holiday'] }, { tagIds: ['t-work'] }];

  it('orders by usage when nothing is typed', () => {
    expect(tagSuggestions(tags, usage, '', []).map((tag) => tag.id)).toEqual([
      't-holiday',
      't-work',
      't-gift',
    ]);
  });

  it('filters by what was typed, case-insensitively', () => {
    expect(tagSuggestions(tags, usage, 'vac', []).map((tag) => tag.id)).toEqual(['t-holiday']);
    expect(tagSuggestions(tags, usage, 'LAV', []).map((tag) => tag.id)).toEqual(['t-work']);
  });

  it('hides tags already on the transaction', () => {
    expect(tagSuggestions(tags, usage, '', ['t-holiday']).map((tag) => tag.id)).toEqual([
      't-work',
      't-gift',
    ]);
  });

  it('offers creation only for a name that does not exist', () => {
    expect(canCreateTag(tags, 'Nuovo')).toBe(true);
    expect(canCreateTag(tags, 'vacanza')).toBe(false);
    expect(canCreateTag(tags, '  Vacanza  ')).toBe(false);
    expect(canCreateTag(tags, '   ')).toBe(false);
  });
});

describe('missingForSave', () => {
  const base = emptyForm(TODAY, 'acc-1');

  it('asks for the amount first, because that is where the form starts', () => {
    expect(missingForSave({ ...base, accountId: null, categoryId: null }, 2)).toBe('amount');
  });

  it('then the account, then the category', () => {
    const withAmount = { ...base, buffer: '12', accountId: null };
    expect(missingForSave(withAmount, 2)).toBe('account');
    expect(missingForSave({ ...withAmount, accountId: 'acc-1' }, 2)).toBe('category');
  });

  it('tells a missing destination apart from one that is the source', () => {
    const transfer = { ...base, kind: 'transfer' as const, buffer: '12', accountId: 'acc-1' };
    expect(missingForSave(transfer, 2)).toBe('destination');
    expect(missingForSave({ ...transfer, toAccountId: 'acc-1' }, 2)).toBe('sameAccount');
    expect(missingForSave({ ...transfer, toAccountId: 'acc-2' }, 2)).toBeNull();
  });

  it('is silent once there is nothing left to fix', () => {
    expect(missingForSave({ ...base, buffer: '12', categoryId: 'cat-1' }, 2)).toBeNull();
  });

  it('agrees with canSave, which is now defined by it', () => {
    const cases = [base, { ...base, buffer: '12' }, { ...base, buffer: '12', categoryId: 'cat-1' }];
    for (const values of cases) {
      expect(canSave(values, 2)).toBe(missingForSave(values, 2) === null);
    }
  });
});
