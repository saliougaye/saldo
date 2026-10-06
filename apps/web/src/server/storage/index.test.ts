import { describe, expect, it } from 'vitest';
import { isValidKey } from './index';

describe('objectKey', () => {
  it('rejects anything that could climb out of a directory or a prefix', () => {
    expect(isValidKey('../escape')).toBe(false);
    expect(isValidKey('user-1/../../escape')).toBe(false);
    expect(isValidKey('user-1')).toBe(false);
    expect(isValidKey('user-1/att-1/extra')).toBe(false);
    expect(isValidKey('user 1/att-1')).toBe(false);
  });
});
