import {
  type AppLocale,
  catalogs,
  type Messages,
  makeTranslator,
  plural,
  type TranslationVars,
} from '@saldo/i18n';

/**
 * The app strings the phone screens show (spec 0.8a §12). They come from the catalogs of
 * `@saldo/i18n`, so a screen says what the app says. A misspelt key fails at typecheck. A key that
 * a catalog lacks throws, so the build fails and the site never ships the raw key.
 */
type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & string];

type AppKey = Path<Messages>;
/** Counted strings: the catalog has `<key>_one` and `<key>_other`. */
type AppCountKey = Extract<AppKey, `${string}_one`> extends `${infer Key}_one` ? Key : never;

function translate(locale: AppLocale, key: string, vars?: TranslationVars): string {
  const text = makeTranslator(catalogs[locale])(key, vars);
  if (text === key) throw new Error(`Missing app string "${key}" in the "${locale}" catalog.`);
  return text;
}

export const appText = (locale: AppLocale, key: AppKey, vars?: TranslationVars): string =>
  translate(locale, key, vars);

export const appCount = (
  locale: AppLocale,
  key: AppCountKey,
  count: number,
  vars?: TranslationVars,
): string => plural((name, values) => translate(locale, name, values), locale, key, count, vars);
