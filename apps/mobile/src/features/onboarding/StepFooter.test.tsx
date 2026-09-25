import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { StepFooter } from './StepFooter';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('../../components/keypad/AmountKeypadProvider', () => ({
  useAmountKeypad: () => ({ session: null }),
}));

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('en', []);
});

async function renderFooter(label?: string) {
  await render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <StepFooter label={label} onPress={jest.fn()} />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('StepFooter', () => {
  it('draws «Back» and the primary action', async () => {
    await renderFooter('Continue');
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('is only the way back when there is no action to offer', async () => {
    await renderFooter();
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
