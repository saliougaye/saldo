import type { Account, GoalProgress, GoalView } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { FEATURED_GOAL_KEY, HomeGoalsCard } from './HomeGoalsCard';

const mockPush = jest.fn();
const mockKv = new Map<string, string>();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../db/hooks', () => ({
  useSettings: () => ({ currency: 'EUR', periodKind: 'month' }),
}));
jest.mock('../period/PeriodProvider', () => ({
  usePeriod: () => ({ today: '2026-09-24', def: { kind: 'month', startDay: 1 } }),
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

function view(
  id: string,
  name: string,
  progress: Partial<GoalProgress>,
  goalDeadline: string | null = '2027-06-30',
): GoalView {
  const account: Account = {
    id,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '1',
    deletedAt: null,
    type: 'pocket',
    institution: null,
    openingBalance: 0,
    includeInSpendable: false,
    colorIndex: 5,
    icon: 'car',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
    parentAccountId: 'checking',
    goalTarget: progress.target ?? 1_200_000,
    goalDeadline,
    goalStartDate: '2026-01-01',
  };
  return {
    account,
    parent: undefined,
    progress: {
      saved: 0,
      target: 1_200_000,
      ratio: 0,
      missing: 1_200_000,
      state: 'onTrack',
      reachedOn: null,
      pace: 0.5,
      gap: 0,
      periodsLeft: 9,
      perPeriod: 0,
      daysLeft: 279,
      ...progress,
    },
  };
}

function card(views: readonly GoalView[]) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <HomeGoalsCard views={views} />
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('HomeGoalsCard', () => {
  it('features the goal furthest behind and says what to set aside each month', async () => {
    await render(
      card([
        view('car', 'Car', {
          saved: 542_000,
          ratio: 0.45,
          missing: 658_000,
          state: 'behind',
          gap: -43_600,
          perPeriod: 73_100,
        }),
        view('trip', 'Japan', { saved: 298_000, target: 350_000, ratio: 0.85, gap: 121_250 }),
      ]),
    );
    expect(screen.getByText('1 behind')).toBeTruthy();
    expect(
      screen.getByText("Set aside €731.00 a month to get there. You're €436.00 behind."),
    ).toBeTruthy();
    expect(screen.queryByText('Japan')).toBeNull();
  });

  it('features an expired goal and gives a reached one its own row', async () => {
    await render(
      card([
        view('gift', 'Gift', { state: 'expired', missing: 11_000, target: 40_000 }, '2026-09-15'),
        view('sofa', 'Sofa', {
          state: 'reached',
          saved: 120_000,
          target: 120_000,
          ratio: 1,
          missing: 0,
          reachedOn: '2026-09-20',
        }),
      ]),
    );
    expect(screen.getByText('1 expired · 1 reached')).toBeTruthy();
    expect(screen.getByLabelText(/^Gift, /)).toBeTruthy();
    expect(screen.getByText('Sofa')).toBeTruthy();
    expect(screen.getByText('Reached')).toBeTruthy();
  });

  it('features the latest reached goal when every goal is reached', async () => {
    await render(
      card([
        view('sofa', 'Sofa', {
          state: 'reached',
          saved: 120_000,
          target: 120_000,
          ratio: 1,
          missing: 0,
          reachedOn: '2026-09-20',
        }),
      ]),
    );
    expect(
      screen.getByText("You've set aside €1,200.00. Close it when you use the money."),
    ).toBeTruthy();
  });

  it('opens the goal, the list, and remembers what it featured', async () => {
    await render(card([view('car', 'Car', { state: 'behind', gap: -1, perPeriod: 1 })]));
    await userEvent.press(screen.getByLabelText(/^Car, /));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/goal/[id]', params: { id: 'car' } });
    await userEvent.press(screen.getByLabelText('All goals, 1'));
    expect(mockPush).toHaveBeenCalledWith('/goals');
    expect(mockKv.get(FEATURED_GOAL_KEY)).toBe('car');
  });

  it('stays on Home without goals and leads to the wizard', async () => {
    await render(card([]));
    expect(screen.getByText('No goals')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('Create a goal'));
    expect(mockPush).toHaveBeenCalledWith('/goal/new');
  });
});
