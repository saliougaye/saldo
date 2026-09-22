import { en } from './locales/en';
import { it } from './locales/it';

export * from './currencyNames';
export * from './format';
export * from './languageNames';
export type { Messages } from './locales/it';
export { en, it };

/** Ready to pass to `i18next.init({ resources })`. */
export const resources = {
  it: { translation: it },
  en: { translation: en },
} as const;
