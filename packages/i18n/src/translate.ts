import type { AppLocale } from './format';
import type { Messages } from './locales/it';

export type TranslationVars = Record<string, string | number>;

/** `{{name}}` filled from `vars`; a variable that was not given is left alone, never emptied. */
export function interpolate(template: string, vars: TranslationVars = {}): string {
  return template.replace(/{{(\w+)}}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

export type Translate = (key: string, vars?: TranslationVars) => string;

/**
 * The `t` of code with no React context: the web's server components and Server Actions (§17.1.7).
 * A missing key answers with itself, so a gap shows up on the page as `web.auth.signInTitle` rather
 * than as an empty element or a crash — and `locales.test.ts` is what stops one being shipped.
 *
 * It does not choose plural forms by itself: a counted string goes through `plural` below, which
 * any translator can sit under — this one on the web, i18next's `t` on the phone.
 */
export function makeTranslator(messages: Messages): Translate {
  return (key, vars) => {
    let node: unknown = messages;
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || node === null || !(part in node)) return key;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? interpolate(node, vars) : key;
  };
}

/**
 * A counted string. The catalogs are i18next's, so they write `_one`/`_other` only (the phone's
 * `withManyPlurals` fills `_many` in); CLDR decides which applies, and `Intl.PluralRules` is what
 * i18next asks as well. French and Portuguese take `_one` at zero too, which a `count === 1` test
 * gets wrong; every other category (`many`, `few`…) reads as `_other` in all seven catalogs.
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
