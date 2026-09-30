import { describe, expect, it } from 'vitest';
import { signedBufferOk } from './amounts';

describe('signedBufferOk', () => {
  it('accepts what the keypad types, with an optional minus', () => {
    expect(signedBufferOk('', 2)).toBe(true);
    expect(signedBufferOk('12.5', 2)).toBe(true);
    expect(signedBufferOk('-120.5', 2)).toBe(true);
  });

  it('refuses what the keypad cannot type', () => {
    expect(signedBufferOk('12.555', 2)).toBe(false);
    expect(signedBufferOk('007', 2)).toBe(false);
    expect(signedBufferOk('1.5', 0)).toBe(false);
  });

  it('refuses an amount past the safe integers', () => {
    expect(signedBufferOk('9999999999999.99', 2)).toBe(false);
  });

  it('lets an edit send back the stored value untouched', () => {
    expect(signedBufferOk('1234567890123.456', 3, '1234567890123.456')).toBe(true);
  });
});
