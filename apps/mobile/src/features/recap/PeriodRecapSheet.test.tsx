import type { Category, PeriodRecap } from '@saldo/core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { HiddenAmountsContext, VISIBLE } from '../hidden/hiddenAmounts';
import { PeriodRecapSheet } from './PeriodRecapSheet';

// Reduce Motion on: the sheet is drawn in place and every bar is already full.
jest.mock('../../theme/motion', () => ({
  ...jest.requireActual('../../theme/motion'),
  useMotion: () => ({ reduced: true, duration: () => 0 }),
}));

function category(id: string, name: string, colorIndex: number): Category {
  return {
    id,
    name,
    colorIndex,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '1',
    deletedAt: null,
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    archivedAt: null,
    sortOrder: 0,
  };
}

const CATEGORIES = [category('cat-home', 'Casa', 5), category('cat-food', 'Ristoranti', 0)];

const RECAP: PeriodRecap = {
  period: { start: '2026-09-01', end: '2026-09-30' },
  income: 245000,
  spent: 187240,
  net: 57760,
  previousNet: 19510,
  usualNet: 35680,
  incomeDelta: 7,
  spentDelta: -11,
  categories: [
    { categoryId: 'cat-home', amount: 72000, aboveUsual: null },
    { categoryId: 'cat-food', amount: 21450, aboveUsual: 62 },
  ],
  otherCategories: { count: 6, amount: 27130 },
  budgets: [
    { budgetId: 'b1', name: 'Ristoranti', spent: 21450, limit: 18000, over: true, carry: 0 },
    { budgetId: 'b2', name: 'Spesa', spent: 38620, limit: 40000, over: false, carry: 1380 },
  ],
  biggestExpense: {
    transactionId: 't1',
    description: 'Affitto',
    categoryId: 'cat-home',
    date: '2026-09-01',
    amount: 72000,
  },
  netWorthChange: 61240,
};

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

async function show(node: ReactElement, hidden = false) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <HiddenAmountsContext.Provider value={{ ...VISIBLE, hidden }}>
            {node}
          </HiddenAmountsContext.Provider>
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('PeriodRecapSheet', () => {
  it('shows the closed month, its net and every section', async () => {
    await show(
      <PeriodRecapSheet
        recap={RECAP}
        kind="month"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('September 2026 is over')).toBeTruthy();
    expect(screen.getByText('Net for the month')).toBeTruthy();
    expect(screen.getByText(/^Last month .* · usually /)).toBeTruthy();
    expect(screen.getByText('+7% vs last month')).toBeTruthy();
    expect(screen.getByText('−11% vs last month')).toBeTruthy();
    expect(screen.getByText('+62% vs usual')).toBeTruthy();
    expect(screen.getByText('6 more categories')).toBeTruthy();
    expect(screen.getByText(/^Over by /)).toBeTruthy();
    expect(screen.getByText(/^Within the limit · .* carried over$/)).toBeTruthy();
    expect(screen.getByText('Affitto')).toBeTruthy();
    expect(screen.getByText('Net worth')).toBeTruthy();
  });

  it('masks the aggregates in hidden mode but not the single biggest expense', async () => {
    await show(
      <PeriodRecapSheet
        recap={RECAP}
        kind="month"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={() => {}}
      />,
      true,
    );
    expect(screen.getAllByLabelText('Amount hidden').length).toBeGreaterThan(3);
    expect(screen.getByText('Affitto')).toBeTruthy();
    expect(screen.getByText(/^Over by .*•/)).toBeTruthy();
  });

  it('names the week and leaves out what has no history', async () => {
    await show(
      <PeriodRecapSheet
        recap={{ ...RECAP, previousNet: null, usualNet: null, incomeDelta: null, spentDelta: null }}
        kind="week"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('The week is over')).toBeTruthy();
    expect(screen.getByText('Net for the week')).toBeTruthy();
    expect(screen.queryByText(/vs last week/)).toBeNull();
    expect(screen.queryByText(/usually/)).toBeNull();
    expect(screen.getByText('Start the new week')).toBeTruthy();
  });

  it('closes once it has left the screen', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    await show(
      <PeriodRecapSheet
        recap={RECAP}
        kind="month"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={onClose}
      />,
    );
    fireEvent.press(screen.getByText('Start the new month'));
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
