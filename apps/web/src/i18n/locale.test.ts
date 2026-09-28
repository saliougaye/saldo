import { describe, expect, it } from 'vitest';
import { acceptedLanguages, webLocale } from './locale';

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

describe('webLocale', () => {
  it('honours an explicit preference over the browser', () => {
    expect(webLocale('sv', 'it-IT,it;q=0.9')).toBe('sv');
  });

  it('takes the first browser language the app speaks', () => {
    expect(webLocale('system', 'ja-JP,ja;q=0.9,de;q=0.8')).toBe('de');
  });

  it('falls back to English when it speaks none of them', () => {
    expect(webLocale('system', 'ja-JP,ko;q=0.9')).toBe('en');
    expect(webLocale('system', null)).toBe('en');
  });
});
