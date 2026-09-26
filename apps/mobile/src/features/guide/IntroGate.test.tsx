import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { IntroGate } from './IntroGate';
import { INTRO_KEY } from './introSchedule';

const COMPLETED = '2026-09-26T08:00:00.000Z';
const mockKv = new Map<string, string>();
let mockCompletedAt: string | null = COMPLETED;

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ onboardingCompletedAt: mockCompletedAt }),
}));
jest.mock('../../db/DatabaseProvider', () => ({
  useDatabase: () => ({
    kv: {
      get: (key: string) => mockKv.get(key) ?? null,
      set: (key: string, value: string) => {
        mockKv.set(key, value);
      },
    },
  }),
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
  mockKv.clear();
  mockCompletedAt = COMPLETED;
});

function renderGate(blocked = false) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <IntroGate blocked={blocked} />
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('IntroGate', () => {
  it('shows the four ideas once, and remembers «Continua» for this onboarding', async () => {
    await renderGate();
    expect(screen.getByRole('header', { name: 'How Saldo thinks' })).toBeTruthy();
    expect(screen.getByText('Left to spend')).toBeTruthy();
    expect(screen.getByText('Recurring')).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('header', { name: 'How Saldo thinks' })).toBeNull();
    expect(mockKv.get(INTRO_KEY)).toBe(COMPLETED);
  });

  it('stays away once seen for this onboarding', async () => {
    mockKv.set(INTRO_KEY, COMPLETED);
    await renderGate();
    expect(screen.queryByRole('header', { name: 'How Saldo thinks' })).toBeNull();
  });

  it('waits for the period recap and for onboarding', async () => {
    await renderGate(true);
    expect(screen.queryByRole('header', { name: 'How Saldo thinks' })).toBeNull();
    mockCompletedAt = null;
    await renderGate();
    expect(screen.queryByRole('header', { name: 'How Saldo thinks' })).toBeNull();
  });
});
