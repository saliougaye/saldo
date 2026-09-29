import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Saliou Gaye')).toBe('SG');
    expect(initials('  ada  lovelace byron ')).toBe('AL');
  });

  it('takes the first two letters of a single name', () => {
    expect(initials('Test')).toBe('TE');
    expect(initials('x')).toBe('X');
  });

  it('is empty for an empty name', () => {
    expect(initials('   ')).toBe('');
  });
});
