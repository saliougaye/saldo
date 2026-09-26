import { periodContaining, shiftPeriod, todayLocal } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PeriodHeader } from './PeriodHeader';
import { PeriodProvider } from './PeriodProvider';

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR', periodKind: 'month', cycleStartDay: 1 }),
  useTransactionsInRange: () => [],
}));

jest.mock('../../db/DatabaseProvider', () => ({
  useRepositories: () => ({ settings: { update: jest.fn() } }),
}));

jest.mock('../../auth/ServerProvider', () => ({
  useServer: () => ({ user: null }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderHeader(maxAhead?: number) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <PeriodProvider>
            <PeriodHeader hideAmounts={false} maxAhead={maxAhead} />
          </PeriodProvider>
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('PeriodHeader', () => {
  it('goes one period ahead and says it has not started yet (§6.15)', async () => {
    await renderHeader();
    const user = userEvent.setup();
    await user.press(screen.getByTestId('period-next'));

    const next = shiftPeriod(
      { kind: 'month', startDay: 1 },
      periodContaining({ kind: 'month', startDay: 1 }, todayLocal()),
      1,
    );
    expect(screen.getByText(`starts ${formatDayMonth(next.start, 'en')}`)).toBeTruthy();
    expect(screen.queryByText('closed period')).toBeNull();
    expect(screen.getByTestId('period-next')).toBeDisabled();
  });

  it('stops at the current period when asked to, as Statistics does (§5.17)', async () => {
    await renderHeader(0);
    expect(screen.getByTestId('period-next')).toBeDisabled();
    expect(screen.getByTestId('period-previous')).toBeEnabled();
  });
});
