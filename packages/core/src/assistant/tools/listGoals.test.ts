import { describe, expect, it } from 'vitest';
import { CONTEXT, fixtureData } from '../__fixtures__/userData';
import { listGoalsTool } from './listGoals';

describe('list_goals', () => {
  it('lists the open goals with their progress and plan', () => {
    expect(listGoalsTool.run(fixtureData(), CONTEXT, {})).toEqual({
      goals: [
        {
          id: 'a-pocket',
          name: 'Vacanze',
          parentAccountId: 'a-main',
          parentAccountName: 'Conto corrente',
          target: { minor: 120000, currency: 'EUR', amount: '1200.00' },
          saved: { minor: 50000, currency: 'EUR', amount: '500.00' },
          missing: { minor: 70000, currency: 'EUR', amount: '700.00' },
          ratio: 50000 / 120000,
          state: 'onTrack',
          startDate: '2026-06-01',
          deadline: '2026-12-31',
          reachedOn: null,
          perPeriod: { minor: 17500, currency: 'EUR', amount: '175.00' },
          periodsLeft: 4,
          daysLeft: 108,
        },
      ],
    });
  });

  it('leaves a closed goal out', () => {
    const data = fixtureData();
    data.accounts = data.accounts.map((account) =>
      account.id === 'a-pocket' ? { ...account, archivedAt: '2026-09-10T00:00:00.000Z' } : account,
    );
    expect(listGoalsTool.run(data, CONTEXT, {}).goals).toEqual([]);
  });
});
