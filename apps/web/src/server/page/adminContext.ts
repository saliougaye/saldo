import { readSettings } from '@saldo/core';
import { instantFormatter } from '../../features/admin/resolveMessage';
import { userI18n, type WebI18n } from '../../i18n/server';
import type { AuthenticatedUser } from '../auth/session';
import { env } from '../env';
import { loadUserData } from '../userData/load';
import { todayFor } from '../userData/today';

export interface AdminContext extends WebI18n {
  timeZone: string;
  /** An ISO instant as a date in the admin's zone and language: `long` for a panel, `short` for a row. */
  formatDate: Record<'long' | 'short', (iso: string) => string>;
}

/**
 * What an admin page needs to speak: the admin's language and time zone. It is `readPage` without
 * the redirect to `/onboarding`: an admin who has never onboarded still administers the instance
 * (§17.1.7), with the language the browser asks for and the instance's default zone.
 */
export async function adminContext(user: Pick<AuthenticatedUser, 'id'>): Promise<AdminContext> {
  const [i18n, data] = await Promise.all([userI18n(user.id), loadUserData(user.id)]);
  const now = new Date();
  const { timeZone } = todayFor(readSettings(data.settings), env().defaultTimeZone, now);
  const format = (style: 'long' | 'short') =>
    instantFormatter({ timeZone, locale: i18n.locale, now, style });
  return { ...i18n, timeZone, formatDate: { long: format('long'), short: format('short') } };
}
