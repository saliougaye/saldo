import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { StepFooter } from './StepFooter';

const mockBack = jest.fn();
let mockCanGoBack = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => mockCanGoBack }),
}));

let i18n: I18nInstance;
beforeAll(async () => {
  i18n = await createI18n('it', []);
});
beforeEach(() => {
  mockBack.mockClear();
  mockCanGoBack = true;
});

function renderFooter(onPress = jest.fn()) {
  return render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <StepFooter label="Continua" onPress={onPress} />
      </I18nextProvider>
    </ThemeProvider>,
  );
}

describe('StepFooter', () => {
  it('goes back from "Indietro" and forward from the primary action', async () => {
    const onPress = jest.fn();
    await renderFooter(onPress);
    await userEvent.press(screen.getByRole('button', { name: 'Indietro' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    await userEvent.press(screen.getByRole('button', { name: 'Continua' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has no "Indietro" when there is nothing behind the screen', async () => {
    mockCanGoBack = false;
    await renderFooter();
    expect(screen.queryByRole('button', { name: 'Indietro' })).toBeNull();
  });
});
