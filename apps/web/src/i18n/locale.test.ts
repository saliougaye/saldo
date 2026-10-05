import { describe, expect, it } from 'vitest';
import { acceptedLanguages } from './locale';

describe('acceptedLanguages', () => {
  it('reads the tags of an Accept-Language header, best first', () => {
    expect(acceptedLanguages('it-IT,it;q=0.9,en-US;q=0.8')).toEqual(['it-IT', 'it', 'en-US']);
  });

  it('sorts by quality, not by position', () => {
    expect(acceptedLanguages('en;q=0.5,de;q=0.9')).toEqual(['de', 'en']);
  });

  it('drops what it cannot use', () => {
    expect(acceptedLanguages('*;q=0.1,fr;q=0')).toEqual(['*']);
    expect(acceptedLanguages(null)).toEqual([]);
    expect(acceptedLanguages('')).toEqual([]);
  });
});
