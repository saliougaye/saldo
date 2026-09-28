import { type AppLocale, type LanguagePreference, resolveLocale } from '@saldo/i18n';

/**
 * `Accept-Language: it-IT,it;q=0.9,en;q=0.8` → `['it-IT', 'it', 'en']`. Sorted by quality, because
 * a browser may send them in any order, and `q=0` means "not this one" rather than "last".
 */
export function acceptedLanguages(header: string | null): string[] {
  if (header === null) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const quality = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
      const weight = quality === undefined ? 1 : Number.parseFloat(quality.slice(2));
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((entry) => entry.tag.length > 0 && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.tag);
}

/**
 * The locale a page renders in: the user's `settings.language` when there is one, else the browser's
 * own order. `resolveLocale` is the phone's rule, so the same account reads the same language on
 * both (§17.1.6).
 */
export function webLocale(
  preference: LanguagePreference,
  acceptLanguage: string | null,
): AppLocale {
  return resolveLocale(preference, acceptedLanguages(acceptLanguage));
}
