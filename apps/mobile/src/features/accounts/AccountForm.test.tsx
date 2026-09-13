import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { AccountForm, emptyAccountForm } from './AccountForm';

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
});
