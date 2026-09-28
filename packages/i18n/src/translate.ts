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
 * Plurals are i18next's on the phone (`_one`/`_other`, filled by `withManyPlurals`). Nothing on the
 * web counts anything yet, so this deliberately does not do them: one place to add them later.
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
