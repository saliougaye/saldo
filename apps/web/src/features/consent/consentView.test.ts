import { describe, expect, it } from 'vitest';
import { parseChosenScopes } from './consentView';

describe('parseChosenScopes', () => {
  it('accepts read, or read and write, in any order', () => {
    expect(parseChosenScopes(['read'])).toEqual(['read']);
    expect(parseChosenScopes(['write', 'read'])).toEqual(['read', 'write']);
  });

  it('refuses anything else from the browser', () => {
    expect(parseChosenScopes([])).toBeNull();
    expect(parseChosenScopes(['write'])).toBeNull();
    expect(parseChosenScopes(['read', 'read'])).toBeNull();
    expect(parseChosenScopes(['read', 'admin'])).toBeNull();
    expect(parseChosenScopes('read')).toBeNull();
    expect(parseChosenScopes(undefined)).toBeNull();
  });
});
