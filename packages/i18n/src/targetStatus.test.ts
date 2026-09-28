import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { budgetCardStatusText, goalCardStatusText } from './targetStatus';
import { makeTranslator } from './translate';

const t = makeTranslator(catalogs.en);

describe('budgetCardStatusText', () => {
  it('says there are none when there are none, rather than «within limits»', () => {
    expect(budgetCardStatusText(0, { kind: 'withinLimits' }, t, 'en')).toBe('No budgets');
  });

  it('counts over the limit, then over pace, then says within limits', () => {
    expect(budgetCardStatusText(3, { kind: 'overLimit', count: 2 }, t, 'en')).toBe(
      '2 over the limit',
    );
    expect(budgetCardStatusText(3, { kind: 'overPace', count: 1 }, t, 'en')).toBe('1 over pace');
    expect(budgetCardStatusText(3, { kind: 'withinLimits' }, t, 'en')).toBe('within limits');
  });
});

describe('goalCardStatusText', () => {
  const none = { expired: 0, behind: 0, reached: 0 };

  it('says there are none when there are none, rather than «on time»', () => {
    expect(goalCardStatusText(0, none, t, 'en')).toBe('No goals');
  });

  it('reads on time with nothing to report', () => {
    expect(goalCardStatusText(2, none, t, 'en')).toBe('on time');
  });

  it('names at most two states, expired first', () => {
    expect(goalCardStatusText(4, { expired: 1, behind: 0, reached: 1 }, t, 'en')).toBe(
      '1 expired · 1 reached',
    );
    expect(goalCardStatusText(6, { expired: 1, behind: 2, reached: 3 }, t, 'en')).toBe(
      '1 expired · 2 behind',
    );
  });

  it('takes the plural the locale takes', () => {
    const fr = makeTranslator(catalogs.fr);
    expect(goalCardStatusText(3, { expired: 2, behind: 0, reached: 0 }, fr, 'fr')).toBe(
      '2 expirés',
    );
  });
});
