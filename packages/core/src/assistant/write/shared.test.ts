import { describe, expect, it } from 'vitest';
import {
  localDateField,
  MAX_TOOL_MINOR,
  positiveMinorField,
  provided,
  refusalMessage,
  versionPairing,
  writeAnnotations,
} from './shared';

describe('schema atoms', () => {
  it('caps amounts at what the keypad types: eight significant digits', () => {
    expect(MAX_TOOL_MINOR).toBe(99_999_999);
    expect(positiveMinorField.safeParse(1).success).toBe(true);
    expect(positiveMinorField.safeParse(MAX_TOOL_MINOR).success).toBe(true);
    expect(positiveMinorField.safeParse(0).success).toBe(false);
    expect(positiveMinorField.safeParse(12.5).success).toBe(false);
    expect(positiveMinorField.safeParse(MAX_TOOL_MINOR + 1).success).toBe(false);
  });

  it('takes a real YYYY-MM-DD date only', () => {
    expect(localDateField.safeParse('2026-09-29').success).toBe(true);
    expect(localDateField.safeParse('2026-02-30').success).toBe(false);
    expect(localDateField.safeParse('29/09/2026').success).toBe(false);
  });
});

describe('versionPairing', () => {
  it('lets a create through with neither id nor updatedAt, and an update with both', () => {
    expect(versionPairing({})).toBeNull();
    expect(versionPairing({ id: 'tx-1', updatedAt: 'hlc' })).toBeNull();
  });
  it('asks for updatedAt when only id is given', () => {
    expect(versionPairing({ id: 'tx-1' })).toMatch(/updatedAt/);
  });
  it('refuses updatedAt without id', () => {
    expect(versionPairing({ updatedAt: 'hlc' })).toMatch(/omit both/);
  });
});

describe('provided', () => {
  it('keeps the fallback only when the field was left out; null is a value', () => {
    expect(provided(undefined, 'kept')).toBe('kept');
    expect(provided(null, 'kept')).toBeNull();
    expect(provided('new', 'kept')).toBe('new');
  });
});

describe('writeAnnotations', () => {
  it('is never read-only nor open-world', () => {
    expect(writeAnnotations(true, false)).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    });
  });
});

describe('refusalMessage', () => {
  it('says how to recover from a conflict: read again with the right tool', () => {
    const message = refusalMessage('transaction', { error: 'conflict' });
    expect(message).toMatch(/Nothing was written/);
    expect(message).toMatch(/list_transactions/);
    expect(message).toMatch(/updatedAt/);
  });

  it('points an account edit of a goal to save_goal', () => {
    expect(refusalMessage('account', { error: 'notFound' })).toMatch(/save_goal/);
    expect(refusalMessage('budget', { error: 'notFound' })).toMatch(/list_budgets/);
  });

  it('tells a taken tag name from a taken budget category', () => {
    expect(refusalMessage('tag', { error: 'taken' })).toMatch(/merge_tags/);
    expect(refusalMessage('budget', { error: 'taken' })).toMatch(/another budget/);
  });

  it('names the missing field the way the tool calls it', () => {
    expect(refusalMessage('transaction', { missing: 'amount' })).toMatch(/amountMinor/);
    expect(refusalMessage('transaction', { missing: 'amount' })).toMatch(/minor units/);
    expect(refusalMessage('goal', { missing: 'parent' })).toMatch(/parentAccountId/);
    expect(refusalMessage('transaction', { missing: 'insufficientFunds' })).toMatch(/below zero/);
  });
});
