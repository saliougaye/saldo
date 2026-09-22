import type { AppLocale } from './format';

/**
 * Each language named in its own tongue, whatever the app's language is: someone looking for their
 * language recognises its own name, not our translation of it. Not catalog strings, on purpose.
 */
export const LANGUAGE_NAMES: Record<AppLocale, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  sv: 'Svenska',
  es: 'Español',
  pt: 'Português',
};
