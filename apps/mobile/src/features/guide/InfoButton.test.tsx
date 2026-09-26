import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { InfoButton } from './InfoButton';

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

describe('InfoButton', () => {
  it('is labelled with its concept and opens the whole text', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider preference="dark">
          <I18nextProvider i18n={i18n}>
            <InfoButton concept="accountTypes" />
          </I18nextProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    expect(screen.queryByRole('header', { name: 'Account types' })).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: 'About: Account types' }));
    expect(screen.getByRole('header', { name: 'Account types' })).toBeTruthy();
    expect(
      screen.getByText('The type decides whether an account counts towards the spendable total.'),
    ).toBeTruthy();
    expect(screen.getByText(/A debit card is an account of its own/)).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('header', { name: 'Account types' })).toBeNull();
  });
});
