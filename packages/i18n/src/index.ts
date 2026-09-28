import type { AppLocale } from './format';
import { de } from './locales/de';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import type { Messages } from './locales/it';
import { it } from './locales/it';
import { pt } from './locales/pt';
import { sv } from './locales/sv';
import { withManyPlurals } from './plurals';

export * from './currencyNames';
export * from './format';
export * from './goalText';
export * from './languageNames';
export type { Messages } from './locales/it';
export * from './targetStatus';
export * from './timeZones';
export * from './translate';
export { de, en, es, fr, it, pt, sv };

/** Every catalog, as written; `it` is the source the others are checked against. */
export const catalogs: Record<AppLocale, Messages> = { it, en, fr, de, sv, es, pt };

/** Ready to pass to `i18next.init({ resources })`, with the `_many` plural filled in. */
export const resources = {
  it: { translation: withManyPlurals(it) },
  en: { translation: withManyPlurals(en) },
  fr: { translation: withManyPlurals(fr) },
  de: { translation: withManyPlurals(de) },
  sv: { translation: withManyPlurals(sv) },
  es: { translation: withManyPlurals(es) },
  pt: { translation: withManyPlurals(pt) },
} as const satisfies Record<AppLocale, { translation: Messages }>;
