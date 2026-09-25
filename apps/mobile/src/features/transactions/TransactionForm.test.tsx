import type { Account, Category } from '@saldo/core';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { TransactionForm } from './TransactionForm';
import { emptyForm, type TransactionFormValues } from './useTransactionForm';

// `ScreenHeader` pulls in expo-router, whose `standard-navigation` dependency ships ESM that the
// jest transform does not reach. Every component test in this app mocks it for the same reason.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));

// The form takes a repository handle from here, and the real module opens the SQLite client at
// import time, which jest cannot load. Nothing under test reaches through the handle.
jest.mock('../../db/DatabaseProvider', () => ({ useRepositories: () => ({}) }));

// `mock`-prefixed so the hoisted `jest.mock` factory below is allowed to close over them.
const mockAccounts: Account[] = [
  account('acc-1', 'Conto corrente'),
  account('acc-2', 'Contanti', { type: 'cash' }),
  account('acc-3', 'Visa', { type: 'credit_card', openingBalance: -5_000 }),
];

const mockCategories: Category[] = [category('cat-1', 'Spesa')];

// Every read the form makes of the database. The transaction history is empty, which is enough:
// it only feeds the category ranking, the tag suggestions and the transfer balance preview, and
// none of those decide whether the form can be saved.
jest.mock('../../db/hooks', () => ({
  useRecurrence: () => null,
  useSettings: () => ({ currency: 'EUR' }),
  useAccounts: () => mockAccounts,
  useCategories: () => mockCategories,
  useTags: () => [],
  useAttachments: () => [],
  useTransactionsInRange: () => [],
}));

const TODAY = '2026-09-13';

function account(id: string, name: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name,
    type: 'checking',
    institution: null,
    openingBalance: 100_000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

function category(id: string, name: string): Category {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name,
    direction: 'expense',
    parentId: null,
    icon: 'tag',
    colorIndex: 0,
    archivedAt: null,
    sortOrder: 0,
  };
}

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

/** `Screen` and `Sheet` both read the insets, and there is no provider in `jest.setup.js`. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Host({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function renderForm(
  values: TransactionFormValues = emptyForm(TODAY, 'acc-1'),
  amountShortcuts?: { key: string; label: string; minor: number }[],
  onChange: (values: TransactionFormValues) => void = jest.fn(),
) {
  return render(
    <Host>
      <TransactionForm
        today={TODAY}
        transactionId="tx-1"
        values={values}
        onChange={onChange}
        mode="new"
        onSubmit={jest.fn()}
        amountShortcuts={amountShortcuts}
      />
    </Host>,
  );
}

describe('TransactionForm', () => {
  it('says what it is waiting for on the very first render, before any keystroke', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByText('Enter an amount to save.')).toBeTruthy();
  });

  it('drops the line and enables the button once there is enough to save', async () => {
    await renderForm({ ...emptyForm(TODAY, 'acc-1'), buffer: '12.50', categoryId: 'cat-1' });
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    expect(screen.queryByText('Enter an amount to save.')).toBeNull();
  });

  it('names whatever is missing, not only the amount', async () => {
    await renderForm({ ...emptyForm(TODAY, 'acc-1'), kind: 'transfer', buffer: '12.50' });
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByText('Choose the destination account.')).toBeTruthy();
  });

  it('warns, without blocking, when a transfer pays a card past zero', async () => {
    const transfer = { ...emptyForm(TODAY, 'acc-1'), kind: 'transfer' as const };
    await renderForm({ ...transfer, toAccountId: 'acc-3', buffer: '100' });
    expect(screen.getByText(/The card will be .*50\.00 in credit\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('says nothing when the transfer only pays the card off', async () => {
    const transfer = { ...emptyForm(TODAY, 'acc-1'), kind: 'transfer' as const };
    await renderForm({ ...transfer, toAccountId: 'acc-3', buffer: '50' });
    expect(screen.queryByText(/in credit/)).toBeNull();
  });

  it('picks the amount from the two-way choice, and names a custom one', async () => {
    const onChange = jest.fn();
    const shortcuts = [
      { key: 'statement', label: 'Statement', minor: 30_000 },
      { key: 'balance', label: 'Whole balance', minor: 35_000 },
    ];
    await renderForm({ ...emptyForm(TODAY, 'acc-1'), buffer: '300' }, shortcuts, onChange);
    expect(screen.getByRole('radio', { name: /^Statement/ })).toBeChecked();
    expect(screen.queryByText('Custom amount')).toBeNull();
    await userEvent.press(screen.getByRole('radio', { name: /^Whole balance/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ buffer: '350' }));
  });

  it('says so when the typed amount is neither of the two', async () => {
    const shortcuts = [
      { key: 'statement', label: 'Statement', minor: 30_000 },
      { key: 'balance', label: 'Whole balance', minor: 35_000 },
    ];
    await renderForm({ ...emptyForm(TODAY, 'acc-1'), buffer: '120' }, shortcuts);
    expect(screen.getByText('Custom amount')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Statement/ })).not.toBeChecked();
  });

  // The keypad and the two-way choice share one buffer: whichever moves it, the other one follows.
  it('types on the keypad and lets the choice follow the figure', async () => {
    const onChange = jest.fn();
    const shortcuts = [
      { key: 'statement', label: 'Statement', minor: 30_000 },
      { key: 'balance', label: 'Whole balance', minor: 35_000 },
    ];
    await renderForm({ ...emptyForm(TODAY, 'acc-1'), buffer: '300' }, shortcuts, onChange);
    // The form opens with the amount focused (mode "new"), so the keypad is already up.
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Statement/ })).toBeChecked();

    // A key press goes through `pressAmountKey`, the same buffer the choice writes.
    await userEvent.press(screen.getByTestId('keypad-key-5'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ buffer: '3005' }));
  });

  it('keeps the keypad up while a segment sets the amount', async () => {
    const onChange = jest.fn();
    const shortcuts = [
      { key: 'statement', label: 'Statement', minor: 30_000 },
      { key: 'balance', label: 'Whole balance', minor: 35_000 },
    ];
    await renderForm({ ...emptyForm(TODAY, 'acc-1'), buffer: '300' }, shortcuts, onChange);
    await userEvent.press(screen.getByRole('radio', { name: /^Whole balance/ }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ buffer: '350' }));
    // The choice is next to the figure, so the pad stays: the amount is still being decided.
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
  });

  it('shows the choice, the custom-amount line and the warning above the keypad', async () => {
    const shortcuts = [
      { key: 'statement', label: 'Statement', minor: 30_000 },
      { key: 'balance', label: 'Whole balance', minor: 35_000 },
    ];
    const transfer = { ...emptyForm(TODAY, 'acc-1'), kind: 'transfer' as const };
    await renderForm({ ...transfer, toAccountId: 'acc-3', buffer: '120' }, shortcuts);
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Statement/ })).toBeTruthy();
    expect(screen.getByText('Custom amount')).toBeTruthy();
    expect(screen.getByText(/in credit/)).toBeTruthy();
  });

  it('puts the keypad away when the form moves on to the description', async () => {
    await renderForm();
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
    await act(async () => {
      fireEvent(screen.getByTestId('txform-amount'), 'blur');
    });
    expect(screen.queryByTestId('amount-keypad')).toBeNull();
  });

  it('leaves the choice out of an ordinary new transaction', async () => {
    await renderForm();
    expect(screen.queryByRole('radio', { name: /^Statement/ })).toBeNull();
    expect(screen.queryByText('Custom amount')).toBeNull();
  });

  it('fills a transfer with the whole balance of its source in one tap', async () => {
    const onChange = jest.fn();
    const transfer = { ...emptyForm(TODAY, 'acc-1'), kind: 'transfer' as const };
    await renderForm({ ...transfer, toAccountId: 'acc-2' }, undefined, onChange);
    const fill = screen.getByRole('button', { name: /^Whole balance · .*1,000\.00/ });
    expect(fill).not.toBeSelected();
    await userEvent.press(fill);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ buffer: '1000' }));
    // Next to the figure, like the choice: the amount is still being decided.
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
  });

  it('reads the fill as chosen while the field holds that amount', async () => {
    const transfer = { ...emptyForm(TODAY, 'acc-1'), kind: 'transfer' as const };
    await renderForm({ ...transfer, toAccountId: 'acc-2', buffer: '1000' });
    expect(screen.getByRole('button', { name: /^Whole balance/ })).toBeSelected();
  });

  it('offers no fill on an expense, from a card in debt or towards a card', async () => {
    await renderForm();
    expect(screen.queryByTestId('txform-fill-balance')).toBeNull();
    screen.unmount();
    const transfer = { ...emptyForm(TODAY, 'acc-3'), kind: 'transfer' as const };
    await renderForm({ ...transfer, toAccountId: 'acc-1' });
    expect(screen.queryByTestId('txform-fill-balance')).toBeNull();
    screen.unmount();
    await renderForm({ ...transfer, accountId: 'acc-1', toAccountId: 'acc-3' });
    expect(screen.queryByTestId('txform-fill-balance')).toBeNull();
  });
});
