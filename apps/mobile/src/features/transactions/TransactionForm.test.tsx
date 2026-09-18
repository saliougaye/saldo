import type { Account, Category } from '@saldo/core';
import { render, screen } from '@testing-library/react-native';
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

function renderForm(values: TransactionFormValues = emptyForm(TODAY, 'acc-1')) {
  return render(
    <Host>
      <TransactionForm
        today={TODAY}
        transactionId="tx-1"
        values={values}
        onChange={jest.fn()}
        mode="new"
        onSubmit={jest.fn()}
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
});
