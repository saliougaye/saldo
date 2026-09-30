import { type CategoryFormValues, emptyCategoryForm } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { CategoryForm } from './CategoryForm';

// `ScreenHeader` pulls in expo-router, whose `standard-navigation` dependency ships ESM that the
// jest transform does not reach. Every component test in this app mocks it for the same reason.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR' }),
  useCategories: () => [],
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

function renderForm(values: CategoryFormValues = emptyCategoryForm()) {
  return render(
    <Host>
      <CategoryForm values={values} onChange={jest.fn()} mode="new" onSubmit={jest.fn()} />
    </Host>,
  );
}

describe('CategoryForm', () => {
  it('keeps the icon library and the swatches off the form', async () => {
    await renderForm();
    expect(screen.queryByLabelText('pizza')).toBeNull();
    expect(screen.queryByLabelText('Terracotta')).toBeNull();
  });

  it('opens them from the preview, which is what shows the result', async () => {
    await renderForm();
    await userEvent.press(screen.getByLabelText('Appearance'));
    expect(screen.getByLabelText('pizza')).toBeTruthy();
    expect(screen.getByLabelText('Terracotta')).toBeTruthy();
  });

  it('offers no monthly budget on an income category, which has nothing to cap', async () => {
    await renderForm({ ...emptyCategoryForm(), direction: 'income' });
    expect(screen.queryByLabelText('Monthly budget')).toBeNull();
  });

  it('says what it is waiting for instead of only greying the button out', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText('Enter a name to save.')).toBeTruthy();
  });

  it('drops the line once the name is there', async () => {
    await renderForm({ ...emptyCategoryForm(), name: 'Spesa' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.queryByText('Enter a name to save.')).toBeNull();
  });
});
