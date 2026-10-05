import { describe, expect, it } from 'vitest';
import { MAX_TOOL_MINOR, positiveMinorField, versionPairing } from './shared';

describe('schema atoms', () => {
  it('caps amounts at what the keypad types: eight significant digits', () => {
    expect(MAX_TOOL_MINOR).toBe(99_999_999);
    expect(positiveMinorField.safeParse(1).success).toBe(true);
    expect(positiveMinorField.safeParse(MAX_TOOL_MINOR).success).toBe(true);
    expect(positiveMinorField.safeParse(0).success).toBe(false);
    expect(positiveMinorField.safeParse(12.5).success).toBe(false);
    expect(positiveMinorField.safeParse(MAX_TOOL_MINOR + 1).success).toBe(false);
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
