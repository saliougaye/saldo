import { readSettings } from '@saldo/core';
import { formatLongDate, localDateOf, wallClock } from '@saldo/i18n';
import { userI18n } from '../../../../src/i18n/server';
import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { listPasskeysForUser } from '../../../../src/server/auth/passkeys';
import { getDb } from '../../../../src/server/db/client';
import { env } from '../../../../src/server/env';
import { loadUserData } from '../../../../src/server/userData/load';
import { resolveTimeZone } from '../../../../src/server/userData/today';
import styles from '../../app.module.css';
import { PasskeyList } from './PasskeyList';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.4: «/profile lists the account's passkeys, and lets the user add, rename and delete them
 * (never the last one), and sign out». The Profile shell and its sub-navigation come with 0.3d; this
 * page keeps its final URL so that step wraps it rather than moving it.
 */
export default async function PasskeysPage() {
  const user = await requireWebUser();
  const { t, locale } = await userI18n(user.id);
  const settings = readSettings((await loadUserData(user.id)).settings);
  const timeZone = resolveTimeZone(settings.timeZone, env().defaultTimeZone);
  const passkeys = await listPasskeysForUser(getDb(), user.id);

  /** The day the passkey was added, in the user's own zone (§17.1.5) — not the server's. */
  const addedOn = (iso: string | null): string | null => {
    if (iso === null) return null;
    const clock = wallClock(timeZone, new Date(iso));
    if (clock === null) return null;
    return t('web.passkeys.addedOn', { date: formatLongDate(localDateOf(clock), locale) });
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t('web.passkeys.title')}</h1>
      <p className={styles.body}>{t('web.passkeys.body')}</p>
      <PasskeyList
        passkeys={passkeys.map((passkey) => ({ ...passkey, addedOn: addedOn(passkey.createdAt) }))}
        strings={{
          add: t('web.passkeys.add'),
          inUse: t('web.passkeys.inUse'),
          synced: t('web.passkeys.synced'),
          notSynced: t('web.passkeys.notSynced'),
          unknownProvider: t('web.passkeys.unknownProvider'),
          rename: t('common.edit'),
          renameTitle: t('web.passkeys.renameTitle'),
          nameLabel: t('web.passkeys.nameLabel'),
          renameHint: t('web.passkeys.renameHint'),
          save: t('common.save'),
          cancel: t('common.cancel'),
          remove: t('common.delete'),
          deleteTitle: t('web.passkeys.deleteTitle'),
          deleteBody: t('web.passkeys.deleteBody'),
          lastOneNote: t('web.passkeys.lastOneNote'),
          empty: t('web.passkeys.empty'),
          working: t('common.loading'),
          failed: t('web.auth.genericError'),
        }}
      />
      <p className={styles.links}>
        <a className={styles.link} href="/home">
          {t('common.goBack')}
        </a>
      </p>
    </main>
  );
}
