import { describe, expect, it } from 'vitest';
import { emptyUserData } from '../userData';
import { CONTEXT, cycleData, fixtureData } from './__fixtures__/userData';
import { assistantInstructions } from './instructions';

describe('assistantInstructions', () => {
  it('tells the model the user’s today, zone, currency and current period', () => {
    const text = assistantInstructions(fixtureData(), CONTEXT);
    expect(text).toContain('Today is 2026-09-15 in Europe/Rome');
    expect(text).toContain('calendar month');
    expect(text).toContain('from 2026-09-01 to 2026-09-30');
    expect(text).toContain('from 2026-08-01 to 2026-08-31');
    expect(text).toContain('in EUR');
    expect(text).toContain('2 decimal digits');
  });

  it('explains amounts, transfers, exclusions and nesting', () => {
    const text = assistantInstructions(fixtureData(), CONTEXT);
    expect(text).toContain('{ minor, currency, amount }');
    expect(text).toContain('Transfers');
    expect(text).toContain('excludeFromTotals');
    expect(text).toContain('two levels deep');
  });

  it('explains how the cycle day moves a pay cycle', () => {
    const text = assistantInstructions(cycleData(), CONTEXT);
    expect(text).toContain('pay cycle starting on day 27');
    expect(text).toContain('from 2026-08-27 to 2026-09-26');
    expect(text).toContain('A cycle starts on day 27');
  });

  it('warns that an account that has not onboarded is empty', () => {
    const text = assistantInstructions(emptyUserData(), CONTEXT);
    expect(text).toContain('has not finished setting up Saldo');
    expect(assistantInstructions(fixtureData(), CONTEXT)).not.toContain('has not finished');
  });
});
