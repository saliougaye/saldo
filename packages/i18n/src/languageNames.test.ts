import { LANGUAGE_PREFERENCES } from '@saldo/core';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from './format';
import { LANGUAGE_NAMES } from './languageNames';

describe('languages', () => {
  it('keeps the setting and the supported locales in step', () => {
    expect(LANGUAGE_PREFERENCES).toEqual(['system', ...SUPPORTED_LOCALES]);
  });

  it('names every language in its own tongue', () => {
    expect(LANGUAGE_NAMES).toEqual({
      it: 'Italiano',
      en: 'English',
      fr: 'Français',
      de: 'Deutsch',
      sv: 'Svenska',
      es: 'Español',
      pt: 'Português',
    });
  });
});
