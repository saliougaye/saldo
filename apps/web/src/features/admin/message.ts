/**
 * What a view hands the page instead of a sentence: an i18n key with its variables, or a literal
 * that is never translated (an address, a version). A view imports no translator, so the page —
 * which knows the locale and the time zone — resolves it.
 *
 * - `count` selects a plural form: the page calls `plural(t, locale, key, count, vars)`, so the
 *   catalogs hold `key_one` / `key_other`.
 * - `dateVars` names the variables that hold a raw ISO instant; the page formats those in the
 *   admin's locale and zone before interpolating.
 */
export type AdminMessage =
  | { text: string }
  | {
      key: string;
      vars?: Record<string, string | number>;
      count?: number;
      dateVars?: readonly string[];
    };
