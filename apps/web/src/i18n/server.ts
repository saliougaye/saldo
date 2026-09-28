import { readSettings } from '@saldo/core';
import { type AppLocale, catalogs, makeTranslator, type Translate } from '@saldo/i18n';
import { headers } from 'next/headers';
import { loadUserData } from '../server/userData/load';
import { webLocale } from './locale';

export interface WebI18n {
  locale: AppLocale;
  t: Translate;
}

function forLocale(locale: AppLocale): WebI18n {
  return { locale, t: makeTranslator(catalogs[locale]) };
}

/**
 * The pages with nobody signed in yet — `/login`, `/register`, `/auth/mobile` — where the browser's
 * `Accept-Language` is all there is to go on.
 */
export async function publicI18n(): Promise<WebI18n> {
  return forLocale(webLocale('system', (await headers()).get('accept-language')));
}

/**
 * A signed-in page: the synced `settings.language`, which is the same preference the phone reads,
 * and the browser's order while it is `system`. One `loadUserData` per request, shared by `cache()`.
 */
export async function userI18n(userId: string): Promise<WebI18n> {
  const data = await loadUserData(userId);
  const settings = readSettings(data.settings);
  return forLocale(webLocale(settings.language, (await headers()).get('accept-language')));
}
