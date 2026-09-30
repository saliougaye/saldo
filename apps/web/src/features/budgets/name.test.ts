import { describe, expect, it } from 'vitest';
import { BUDGET_NAME_MAX, resolveBudgetName } from './name';

describe('resolveBudgetName', () => {
  it('prefers the typed name, trimmed', () => {
    expect(resolveBudgetName('  Casa ', 'Auto')).toBe('Casa');
  });

  it('falls back to the built name', () => {
    expect(resolveBudgetName('  ', 'Auto')).toBe('Auto');
  });

  it('cuts either to what the server accepts', () => {
    const long = 'x'.repeat(BUDGET_NAME_MAX + 10);
    expect(resolveBudgetName('', long)).toHaveLength(BUDGET_NAME_MAX);
    expect(resolveBudgetName(long, 'Auto')).toHaveLength(BUDGET_NAME_MAX);
  });
});
