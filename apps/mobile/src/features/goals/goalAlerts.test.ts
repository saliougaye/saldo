import type { GoalView } from '@saldo/core';
import { goalAlertKey, pendingGoalAlerts } from './goalAlerts';

const view = (id: string, state: GoalView['progress']['state']) =>
  ({ account: { id, name: id }, progress: { state, target: 1000 } }) as unknown as GoalView;

describe('pendingGoalAlerts', () => {
  it('notifies a reached goal once, ever', () => {
    const store = new Map<string, string>([[goalAlertKey('old'), '2026-09-01']]);
    const pending = pendingGoalAlerts(
      [view('new', 'reached'), view('old', 'reached'), view('car', 'behind')],
      { get: (key: string) => store.get(key) ?? null },
    );
    expect(pending.map((goal) => goal.account.id)).toEqual(['new']);
  });
});
