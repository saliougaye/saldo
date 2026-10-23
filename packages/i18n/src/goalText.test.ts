import type { GoalProgress } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';
import { type GoalTextDeps, type GoalTextSubject, goalSentence, goalStatus } from './goalText';
import { catalogs } from './index';
import { makeTranslator } from './translate';

const deps: GoalTextDeps = {
  t: makeTranslator(catalogs.it),
  locale: 'it',
  money: (minor) => formatMoney(minor, 'EUR', 'it'),
  today: '2026-10-24',
  periodKind: 'month',
};

/** A goal with a deadline a year away, at `gap` from its pace and in the state core gave it. */
function subject(state: GoalProgress['state'], gap: number): GoalTextSubject {
  return {
    account: { name: 'Vacanze', goalDeadline: '2027-06-30', goalStartDate: '2026-01-01' },
    progress: {
      saved: 90000,
      target: 300000,
      ratio: 0.3,
      missing: 210000,
      state,
      reachedOn: null,
      pace: 0.37,
      gap,
      periodsLeft: 9,
      perPeriod: 23334,
      daysLeft: 250,
    },
  };
}

describe('goal status and sentence', () => {
  // Bug: a goal a little behind its pace, but within one period's share, is `onTrack`; the row read
  // «−13,61 € avanti» and the panel «Sei 13,61 € avanti.».
  it('reads «nei tempi» for an on-track goal a little behind its pace (bug: «−13,61 € avanti»)', () => {
    const goal = subject('onTrack', -1361);
    expect(goalStatus(goal, deps)).toBe('nei tempi');
    expect(goalSentence(goal, deps).state).toBe('Sei nei tempi.');
  });

  it('reads the amount ahead for an on-track goal ahead of its pace', () => {
    const goal = subject('onTrack', 1361);
    expect(goalStatus(goal, deps)).toBe('13,61 € avanti');
    expect(goalSentence(goal, deps).state).toBe('Sei 13,61 € avanti.');
  });

  it('reads the amount behind for a goal behind its pace', () => {
    const goal = subject('behind', -40000);
    expect(goalStatus(goal, deps)).toBe('400,00 € indietro');
    expect(goalSentence(goal, deps).state).toBe('Sei 400,00 € indietro.');
  });
});
