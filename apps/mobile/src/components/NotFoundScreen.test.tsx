import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { NotFoundScreen } from './NotFoundScreen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));

// `Screen` wires pull-to-refresh to sync; this screen owes it nothing more than the wiring.
jest.mock('../sync/useSyncRefresh', () => ({
  useSyncRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockCanGoBack = true;
});

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <NotFoundScreen />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('NotFoundScreen', () => {
  it('says the record is gone and goes back', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Not here any more' })).toBeTruthy();
    // The header back button and the action share a label; the action is the last one.
    const buttons = screen.getAllByRole('button', { name: 'Back' });
    const action = buttons[buttons.length - 1];
    if (action === undefined) throw new Error('no action');
    await userEvent.press(action);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('goes home when a deep link left nothing behind it', async () => {
    mockCanGoBack = false;
    await renderScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
