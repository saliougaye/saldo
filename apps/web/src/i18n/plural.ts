import type { AppLocale, Translate, TranslationVars } from '@saldo/i18n';

/**
 * The phone's catalogs are i18next's, so a counted string is written `_one`/`_other` and
 * `makeTranslator` deliberately does not choose between them (§17.1.6). CLDR does: French takes
 * `_one` at zero as well, which a `count === 1` test would get wrong.
 *
 * Shared by every web screen that counts something; the catalogs write only the two forms, and
 * `withManyPlurals` fills the third one in for the phone.
 */
export function plural(
  t: Translate,
  locale: AppLocale,
  key: string,
  count: number,
  vars: TranslationVars = {},
): string {
  const category = new Intl.PluralRules(locale).select(count);
  return t(`${key}_${category === 'one' ? 'one' : 'other'}`, { ...vars, count });
}
