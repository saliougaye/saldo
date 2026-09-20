import type { Budget } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { HomeBudgetCard } from './HomeBudgetCard';
import type { BudgetView } from './useBudgetProgress';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR' }),
  useCategories: () => [{ id: 'cat-groceries', name: 'Spesa', colorIndex: 2 }],
}));

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockPush.mockClear();
});

function budget(overrides: Partial<Budget> & Pick<Budget, 'id' | 'name'>): Budget {
  return {
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
    ...overrides,
  };
}

function view(overrides: Partial<BudgetView> & Pick<BudgetView, 'budget' | 'ratio'>): BudgetView {
  return {
    spent: 10_000,
    limit: 40_000,
    overPace: false,
    overLimit: false,
    alertReached: false,
    range: { start: '2026-03-27', end: '2026-04-26' },
    daysLeft: 8,
    open: true,
    limitWithCarry: 40_000,
    ...overrides,
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
  it('ranks the budgets by ratio and keeps the top three', async () => {
    await render(
      card([
        view({ budget: budget({ id: 'b1', name: 'Spesa' }), ratio: 0.2 }),
        view({ budget: budget({ id: 'b2', name: 'Bollette' }), ratio: 0.9 }),
        view({ budget: budget({ id: 'b3', name: 'Ristoranti' }), ratio: 0.5 }),
        view({ budget: budget({ id: 'b4', name: 'Benzina' }), ratio: 0.1 }),
      ]),
    );
    expect(screen.getByText('Bollette')).toBeTruthy();
    expect(screen.getByText('Ristoranti')).toBeTruthy();
    expect(screen.getByText('Spesa')).toBeTruthy();
    expect(screen.queryByText('Benzina')).toBeNull();
  });

  it('opens the full list from the header', async () => {
    await render(card([view({ budget: budget({ id: 'b1', name: 'Spesa' }), ratio: 0.2 })]));
    await userEvent.press(screen.getByText('Budget'));
    expect(mockPush).toHaveBeenCalledWith('/budgets');
  });

  /**
   * The card used to render nothing without budgets, which left the Budgets screen — and with it
   * the new-budget wizard — unreachable on a fresh install.
   */
  it('says there is no budget yet rather than disappearing', async () => {
    await render(card([]));
    expect(screen.getByText('No budgets')).toBeTruthy();
  });

  it('leads to the budgets screen from the empty state, where the wizard lives', async () => {
    await render(card([]));
    await userEvent.press(screen.getByText('No budgets'));
    expect(mockPush).toHaveBeenCalledWith('/budgets');
  });
});
