import { addDays, type DateRange, todayLocal } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PeriodHeader } from './PeriodHeader';
import { PeriodProvider, usePeriod } from './PeriodProvider';

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

/** Selects a custom range once mounted, as the period sheet does. */
function SelectRange({ range }: { range: DateRange }) {
  const { setCustomRange } = usePeriod();
  // biome-ignore lint/correctness/useExhaustiveDependencies: select once, on mount
  useEffect(() => setCustomRange(range), []);
  return null;
}

async function renderHeader(range?: DateRange) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <PeriodProvider>
            {range === undefined ? null : <SelectRange range={range} />}
            <PeriodHeader hideAmounts={false} />
          </PeriodProvider>
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('PeriodHeader', () => {
  it('stops › at the current period (§6.15)', async () => {
    await renderHeader();
    expect(screen.getByTestId('period-next')).toBeDisabled();
    expect(screen.getByTestId('period-previous')).toBeEnabled();
  });

  it('says a custom range ahead starts later, not that it closed', async () => {
    const start = addDays(todayLocal(), 40);
    await renderHeader({ start, end: addDays(start, 9) });
    expect(screen.getByText(`starts ${formatDayMonth(start, 'en')}`)).toBeTruthy();
    expect(screen.queryByText('closed period')).toBeNull();
  });
});
