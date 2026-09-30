import { emptyUserData } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { ACCOUNT, account } from '../test/fixtures';
import { archivedView } from './archivedView';

const at = (day: string) => `2026-${day}T00:00:00.000Z`;

describe('archivedView', () => {
  it('is empty when nothing is archived', () => {
    const view = archivedView({ ...emptyUserData(), accounts: [ACCOUNT] });
    expect(view).toEqual({ accounts: [], goals: [] });
  });

  it('lists archived accounts and closed goals apart, newest archived first', () => {
    const pocket = (id: string, when: string) =>
      account({
        id,
        name: id,
        type: 'pocket',
        parentAccountId: ACCOUNT.id,
        includeInSpendable: false,
        goalTarget: 1000,
        goalStartDate: '2026-01-01',
        archivedAt: at(when),
      });
    const view = archivedView({
      ...emptyUserData(),
      accounts: [
        ACCOUNT,
        account({ id: 'x1', name: 'Uno', archivedAt: at('03-01') }),
        account({ id: 'x2', name: 'Due', archivedAt: at('05-01') }),
        pocket('g1', '04-01'),
        pocket('g2', '06-01'),
      ],
    });
    expect(view.accounts.map((a) => a.id)).toEqual(['x2', 'x1']);
    expect(view.accounts[0]).toEqual({
      id: 'x2',
      name: 'Due',
      icon: 'wallet',
      colorIndex: 0,
      archivedAt: at('05-01'),
    });
    expect(view.goals.map((g) => g.id)).toEqual(['g2', 'g1']);
    expect(view.goals[0]?.parentName).toBe('Conto');
    expect(view.goals.every((g) => g.canRestore)).toBe(true);
  });

  it('cannot restore a goal whose parent is archived', () => {
    const parent = account({ id: 'par', name: 'Padre', archivedAt: at('02-01') });
    const goal = account({
      id: 'g1',
      name: 'Meta',
      type: 'pocket',
      parentAccountId: 'par',
      includeInSpendable: false,
      goalTarget: 1000,
      goalStartDate: '2026-01-01',
      archivedAt: at('01-01'),
    });
    const view = archivedView({ ...emptyUserData(), accounts: [parent, goal] });
    expect(view.goals[0]?.canRestore).toBe(false);
    expect(view.goals[0]?.parentName).toBe('Padre');
  });
});
