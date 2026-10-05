import { describe, expect, it } from 'vitest';
import { type BudgetTargetInput, budgetAdvice, rankBudget } from './budgetTargets';

function budget(id: string, spent: number, limit: number, pace = 0.8): BudgetTargetInput {
  const ratio = spent / limit;
  return {
    id,
    pace,
    progress: { spent, limit, ratio, overPace: ratio > pace, overLimit: ratio > 1 },
  };
}

describe('rankBudget', () => {
  it('puts a budget over its limit in the top tier, scored by the overrun in money', () => {
    expect(rankBudget(budget('spesa', 43080, 42000))).toEqual({
      id: 'spesa',
      tier: 2,
      score: 1080,
      margin: 2100,
    });
  });

  it('puts a budget over pace in the middle tier, scored by how far past the pace', () => {
    const ranked = rankBudget(budget('shopping', 8900, 10000));
    expect(ranked.tier).toBe(1);
    expect(ranked.score).toBeCloseTo(0.09, 10);
    expect(ranked.margin).toBe(0.05);
  });

  it('ranks the rest by how close they are to the pace', () => {
    const ranked = rankBudget(budget('trasporti', 11780, 25000));
    expect(ranked.tier).toBe(0);
    expect(ranked.score).toBeCloseTo(0.4712 / 0.8, 10);
  });

  it('scores the rest by ratio alone on the first day, when the pace is 0', () => {
    expect(rankBudget(budget('svago', 0, 12000, 0)).score).toBe(0);
  });
});

describe('budgetAdvice', () => {
  it('spreads what is left over the days left, today included, rounding down', () => {
    // 420,00 € limit, 368,40 € spent, pace 0.8: 51,60 € over 7 days.
    const input = budget('spesa', 36840, 42000);
    expect(budgetAdvice(input.progress, input.pace, true, 7)).toEqual({
      kind: 'perDay',
      perDay: 737,
      gap: 3240,
      overPace: true,
    });
  });

  it('reports the gap under pace as a positive amount', () => {
    const input = budget('spesa', 30120, 42000);
    expect(budgetAdvice(input.progress, input.pace, true, 7)).toMatchObject({
      gap: 3480,
      overPace: false,
    });
  });

  it('says by how much the limit is exceeded', () => {
    const input = budget('spesa', 43080, 42000);
    expect(budgetAdvice(input.progress, input.pace, true, 7)).toEqual({
      kind: 'overLimit',
      overrun: 1080,
    });
  });

  it('gives no advice per day on a closed range, only where it ended', () => {
    const input = budget('spesa', 30120, 42000, 1);
    expect(budgetAdvice(input.progress, input.pace, false, 0)).toEqual({
      kind: 'closed',
      percent: 72,
    });
  });

  it('never divides by zero days', () => {
    const input = budget('spesa', 30120, 42000, 1);
    expect(budgetAdvice(input.progress, input.pace, true, 0)).toMatchObject({ perDay: 11880 });
  });
});
