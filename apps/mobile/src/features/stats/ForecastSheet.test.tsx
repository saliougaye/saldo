import type { ForecastPeriod } from '@saldo/core';
import { render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { HiddenAmountsProvider } from '../hidden/HiddenAmountsProvider';
import { ForecastSheet } from './ForecastSheet';

let mockHidden = false;

// Hidden mode reads one key out of `kv`; the SQLite-backed provider is not needed for that.
jest.mock('../../db/DatabaseProvider', () => ({
  useDatabase: () => ({
    kv: {
      get: (key: string) => (key === 'amountsHidden' && mockHidden ? 'true' : null),
      set: () => {},
    },
  }),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const PERIODS: ForecastPeriod[] = [
  {
    range: { start: '2026-10-01', end: '2026-10-31' },
    income: 265_000,
    expenses: 221_000,
    expensesMin: 198_000,
    expensesMax: 293_000,
    balance: 885_200,
  },
  {
    range: { start: '2026-11-01', end: '2026-11-30' },
    income: 265_000,
    expenses: 263_000,
    expensesMin: 240_000,
    expensesMax: 335_000,
    balance: 887_200,
  },
  {
    range: { start: '2026-12-01', end: '2026-12-31' },
    income: 265_000,
    expenses: 221_000,
    expensesMin: 198_000,
    expensesMax: 293_000,
    balance: 931_200,
  },
];

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

async function renderSheet() {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <HiddenAmountsProvider>
            <ForecastSheet
              visible
              onClose={() => {}}
              periods={PERIODS}
              currency="EUR"
              locale="en"
              today="2026-09-26"
            />
          </HiddenAmountsProvider>
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('ForecastSheet', () => {
  afterEach(() => {
    mockHidden = false;
  });

  it('leads with the balance at the end of the last period, then one row per period', async () => {
    await renderSheet();
    expect(screen.getByText('By December 31, 2026, about')).toBeTruthy();
    expect(screen.getByText('Oct 1 – Oct 31')).toBeTruthy();
    expect(screen.getByText('Nov 1 – Nov 30')).toBeTruthy();
    expect(screen.getByText('Dec 1 – Dec 31')).toBeTruthy();
    expect(screen.getAllByText('+440')).toHaveLength(2);
    expect(screen.getByText('+20')).toBeTruthy();
    expect(screen.getAllByText('between 1,980 and 2,930')).toHaveLength(2);
    expect(screen.getByLabelText('About: Forecast')).toBeTruthy();
  });

  it('masks every figure in hidden mode', async () => {
    mockHidden = true;
    await renderSheet();
    expect(screen.queryByText('+440')).toBeNull();
    expect(screen.queryByText('between 1,980 and 2,930')).toBeNull();
    expect(screen.getAllByText('••••').length).toBeGreaterThanOrEqual(6);
  });
});
