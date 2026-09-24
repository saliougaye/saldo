import type { Account } from '@saldo/core';
import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { AccountForm, accountFormFrom, emptyAccountForm, openingBalanceFrom } from './AccountForm';

// `ScreenHeader` pulls in expo-router, whose `standard-navigation` dependency ships ESM that the
// jest transform does not reach. Every component test in this app mocks it for the same reason.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR' }),
}));

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

function renderForm(values = emptyAccountForm()) {
  return render(
    <Host>
      <AccountForm values={values} onChange={jest.fn()} mode="new" onSubmit={jest.fn()} />
    </Host>,
  );
}

describe('AccountForm', () => {
  it('keeps the colour and icon grids off the form', async () => {
    await renderForm();
    expect(screen.queryByLabelText('Terracotta')).toBeNull();
    expect(screen.queryByLabelText('piggy')).toBeNull();
  });

  it('opens them from the appearance row', async () => {
    await renderForm();
    await userEvent.press(screen.getByText('Appearance'));
    expect(screen.getByLabelText('Terracotta')).toBeTruthy();
    expect(screen.getByLabelText('piggy')).toBeTruthy();
  });

  it('hides the credit-card day rows on an account that is not a credit card', async () => {
    await renderForm();
    expect(screen.queryByText('Statement closes on')).toBeNull();
    expect(screen.queryByText('Charged on')).toBeNull();
  });

  it('shows the credit-card day rows for a credit card', async () => {
    await renderForm({ ...emptyAccountForm(), type: 'credit_card' });
    expect(screen.getByText('Statement closes on')).toBeTruthy();
    expect(screen.getByText('Charged on')).toBeTruthy();
  });

  it('picks the payment account of a credit card among live accounts that are not cards', async () => {
    const base: Account = {
      id: 'a1',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '0',
      deletedAt: null,
      name: 'Conto BPM',
      type: 'checking',
      institution: null,
      openingBalance: 0,
      includeInSpendable: true,
      colorIndex: 0,
      icon: 'landmark',
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: 0,
    };
    const accounts: Account[] = [
      base,
      { ...base, id: 'a2', name: 'Amex', type: 'credit_card' },
      { ...base, id: 'a3', name: 'Vecchio', archivedAt: '2026-09-02T00:00:00.000Z' },
    ];
    const onChange = jest.fn();
    await render(
      <Host>
        <AccountForm
          values={{ ...emptyAccountForm(), type: 'credit_card' }}
          onChange={onChange}
          mode="new"
          onSubmit={jest.fn()}
          accounts={accounts}
        />
      </Host>,
    );
    expect(screen.getByText('Paid from')).toBeTruthy();
    await userEvent.press(screen.getByText('Paid from'));
    expect(screen.queryByText('Amex')).toBeNull();
    expect(screen.queryByText('Vecchio')).toBeNull();
    await userEvent.press(screen.getByText('Conto BPM'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ creditPaymentAccountId: 'a1' }),
    );
  });

  it('only offers the types that can hold goals to an account that holds some', async () => {
    const parent: Account = {
      id: 'a1',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '0',
      deletedAt: null,
      name: 'Conto BPM',
      type: 'checking',
      institution: null,
      openingBalance: 0,
      includeInSpendable: true,
      colorIndex: 0,
      icon: 'landmark',
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: 0,
    };
    const pocket: Account = {
      ...parent,
      id: 'p1',
      name: 'Macchina',
      type: 'pocket',
      includeInSpendable: false,
      parentAccountId: 'a1',
      goalTarget: 100_000,
      goalDeadline: null,
      goalStartDate: '2026-09-01',
    };
    await render(
      <Host>
        <AccountForm
          values={accountFormFrom(parent, 0, 2)}
          onChange={jest.fn()}
          mode="edit"
          onSubmit={jest.fn()}
          accounts={[parent, pocket]}
          accountId="a1"
        />
      </Host>,
    );
    await userEvent.press(screen.getByText('Type'));
    expect(screen.getByText('Savings')).toBeTruthy();
    expect(screen.queryByText('Credit card')).toBeNull();
    expect(screen.queryByText('Investments')).toBeNull();
  });

  it('keeps the payment account row off an account that is not a credit card', async () => {
    await renderForm();
    expect(screen.queryByText('Paid from')).toBeNull();
  });

  it('says what it is waiting for instead of only greying the button out', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Enter a name to save.')).toBeTruthy();
  });

  it('drops the line once the name is there', async () => {
    await renderForm({ ...emptyAccountForm(), name: 'Conto corrente' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.queryByText('Enter a name to save.')).toBeNull();
  });

  it('offers a sign switch, so a balance can be entered below zero', async () => {
    await renderForm();
    expect(screen.getByRole('switch', { name: 'Negative' })).not.toBeChecked();
  });

  // The rows under the balance open sheets over the keypad; a sheet must not be the reason the
  // balance loses its keypad, and the keypad must not be the reason a row is out of reach.
  it('opens a sheet over the keypad, and still has the keypad behind it', async () => {
    await renderForm({ ...emptyAccountForm(), type: 'credit_card' });
    await act(async () => {
      fireEvent(screen.getByLabelText('Current balance'), 'focus');
    });
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
    await userEvent.press(screen.getByText('Appearance'));
    expect(screen.getByLabelText('Close')).toBeTruthy();
    expect(screen.getByTestId('amount-keypad')).toBeTruthy();
  });
});

describe('a negative balance', () => {
  const card: Account = {
    id: 'acc-card',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '0',
    deletedAt: null,
    name: 'Carta',
    type: 'credit_card',
    institution: null,
    openingBalance: 0,
    includeInSpendable: false,
    colorIndex: 0,
    icon: 'card',
    creditCloseDay: 5,
    creditChargeDay: 15,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  };

  it('keeps its sign when an account is opened for editing', () => {
    expect(accountFormFrom(card, -41235, 2).buffer).toBe('-412.35');
  });

  it('is stored below zero on a new account', () => {
    const values = { ...emptyAccountForm(), buffer: '-412.35' };
    expect(openingBalanceFrom(values, 2, { accountId: null, txs: [], today: '2026-09-17' })).toBe(
      -41235,
    );
  });
});
