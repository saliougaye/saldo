import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import GuidePage from '../../../app/guide/[id]';
import GuideScreen from '../../../app/guide/index';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { GUIDE_CONCEPTS } from './concepts';

const mockPush = jest.fn();
let mockId: string | undefined = 'remaining';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: mockId }),
}));
jest.mock('../../sync/useSyncRefresh', () => ({
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
  mockPush.mockClear();
  mockId = 'remaining';
});

function wrap(node: React.ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>{node}</I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('Guida', () => {
  it('lists every concept and opens its page', async () => {
    await wrap(<GuideScreen />);
    for (const concept of GUIDE_CONCEPTS) {
      expect(screen.getByTestId(`guide-${concept.id}`)).toBeTruthy();
    }
    expect(
      screen.getByText('This period’s income minus its expenses, not your bank balance.'),
    ).toBeTruthy();
    await userEvent.press(screen.getByTestId('guide-budgets'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/guide/[id]', params: { id: 'budgets' } });
  });

  it('shows a concept with its whole body', async () => {
    await wrap(<GuidePage />);
    expect(screen.getByRole('header', { name: 'Left to spend' })).toBeTruthy();
    expect(
      screen.getByText('What your accounts actually hold is on the Accounts tab.'),
    ).toBeTruthy();
  });

  it('answers an unknown concept with «not found»', async () => {
    mockId = 'nope';
    await wrap(<GuidePage />);
    expect(screen.getByRole('header', { name: 'Not here any more' })).toBeTruthy();
  });
});
