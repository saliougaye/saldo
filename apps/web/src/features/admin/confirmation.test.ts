import { describe, expect, it } from 'vitest';
import { confirmationMatches } from './confirmation';

describe('confirmationMatches', () => {
  it('ignores case and surrounding blanks', () => {
    expect(confirmationMatches('  Awa@Example.com ', 'awa@example.com')).toBe(true);
    expect(confirmationMatches('awa gaye', ' Awa Gaye')).toBe(true);
  });

  it('refuses anything else, including a prefix', () => {
    expect(confirmationMatches('awa@example.co', 'awa@example.com')).toBe(false);
    expect(confirmationMatches('awa@example.comx', 'awa@example.com')).toBe(false);
  });

  it('never matches an empty field, even against an empty expectation', () => {
    expect(confirmationMatches('', 'awa@example.com')).toBe(false);
    expect(confirmationMatches('   ', 'awa@example.com')).toBe(false);
    expect(confirmationMatches('', '')).toBe(false);
  });
});
