import { describe, expect, it } from 'vitest';
import { legacyBudgetsTarget } from './legacyRedirect';

describe('legacyBudgetsTarget', () => {
  it('goes to the new path when there is no query', () => {
    expect(legacyBudgetsTarget({})).toBe('/profile/budgets');
  });

  it('keeps a bare flag such as ?new', () => {
    expect(legacyBudgetsTarget({ new: '' })).toBe('/profile/budgets?new=');
  });

  it('keeps the budget id and every other parameter', () => {
    expect(legacyBudgetsTarget({ b: 'abc', from: '2026-09-01' })).toBe(
      '/profile/budgets?b=abc&from=2026-09-01',
    );
  });

  it('keeps repeated parameters and skips undefined ones', () => {
    expect(legacyBudgetsTarget({ x: ['1', '2'], y: undefined })).toBe('/profile/budgets?x=1&x=2');
  });
});
