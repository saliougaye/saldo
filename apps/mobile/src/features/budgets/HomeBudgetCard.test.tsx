import type { Budget } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { FEATURED_BUDGET_KEY, HomeBudgetCard } from './HomeBudgetCard';
import type { BudgetView } from './useBudgetProgress';

const mockPush = jest.fn();
const mockKv = new Map<string, string>();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR' }),
  useCategories: () => [{ id: 'cat-groceries', name: 'Spesa', colorIndex: 2 }],
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

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockPush.mockClear();
  mockKv.clear();
});

function budget(id: string, name: string): Budget {
  return {
    id,
    name,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '1',
    deletedAt: null,
    categoryIds: ['cat-groceries'],
    amount: 40_000,
    period: 'period',
    alertThreshold: null,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
  };
}

/** A budget in the cycle 27 Mar – 26 Apr, today 18 Apr: pace 0.5 for round numbers. */
function view(id: string, name: string, spent: number, limit = 40_000, pace = 0.5): BudgetView {
  const ratio = spent / limit;
  return {
    budget: budget(id, name),
    spent,
    limit,
    ratio,
    overPace: ratio > pace,
    overLimit: ratio > 1,
    alertReached: false,
    range: { start: '2026-03-27', end: '2026-04-26' },
    daysLeft: 7,
    pace,
    open: true,
    limitWithCarry: limit,
  };
}

function card(views: readonly BudgetView[]) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <HomeBudgetCard views={views} />
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('HomeBudgetCard', () => {
  it('features the budget furthest over its limit and gives the other one a row', async () => {
    await render(
      card([
        view('b1', 'Spesa', 43_080, 42_000),
        view('b2', 'Ristoranti', 20_800, 20_000),
        view('b3', 'Trasporti', 11_780, 25_000),
      ]),
    );
    expect(screen.getByText('2 over the limit')).toBeTruthy();
    expect(screen.getByLabelText('Spesa, €430.80 of €420.00, €10.80 over the limit')).toBeTruthy();
    expect(screen.getByText('Ristoranti')).toBeTruthy();
    expect(screen.getByText('€8.00 over the limit')).toBeTruthy();
    // Neither featured nor an exception: only a ring in the «All budgets» row.
    expect(screen.queryByText('Trasporti')).toBeNull();
  });

  it('features the budget furthest past its pace and says how much is left per day', async () => {
    await render(card([view('b1', 'Spesa', 30_000), view('b2', 'Svago', 4_000)]));
    expect(screen.getByText('1 over pace')).toBeTruthy();
    // 100,00 € left over 8 days (today included); 300,00 € spent against 200,00 € of pace.
    expect(
      screen.getByText("You can still spend €12.50 a day until Apr 26. You're €100.00 over pace."),
    ).toBeTruthy();
    expect(screen.queryByText('Svago')).toBeNull();
  });

  it('opens the list from the «All budgets» row, which counts every budget', async () => {
    await render(
      card([view('b1', 'Spesa', 30_000), view('b2', 'Svago', 4_000), view('b3', 'Bar', 1_000)]),
    );
    await userEvent.press(screen.getByLabelText('All budgets, 3'));
    expect(mockPush).toHaveBeenCalledWith('/budgets');
  });

  it('opens the featured budget on the budgets screen', async () => {
    await render(card([view('b1', 'Spesa', 30_000)]));
    await userEvent.press(screen.getByLabelText(/^Spesa, /));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/budgets', params: { open: 'b1' } });
  });

  it('keeps the budget it featured last while a rival is only slightly further along', async () => {
    mockKv.set(FEATURED_BUDGET_KEY, 'b2');
    // Both over pace: 0.62 − 0.5 against 0.60 − 0.5, two points apart, under the five-point margin.
    await render(card([view('b1', 'Spesa', 24_800), view('b2', 'Bollette', 24_000)]));
    expect(screen.getByLabelText(/^Bollette, /)).toBeTruthy();
  });

  it('remembers the budget it features', async () => {
    await render(card([view('b1', 'Spesa', 30_000), view('b2', 'Svago', 4_000)]));
    expect(mockKv.get(FEATURED_BUDGET_KEY)).toBe('b1');
  });

  /**
   * The card used to render nothing without budgets, which left the Budgets screen — and with it
   * the new-budget wizard — unreachable on a fresh install.
   */
  it('says there is no budget yet and still leads to the budgets screen', async () => {
    await render(card([]));
    expect(screen.getByText('No budgets')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Create a budget'));
    expect(mockPush).toHaveBeenCalledWith('/budgets');
  });
});
