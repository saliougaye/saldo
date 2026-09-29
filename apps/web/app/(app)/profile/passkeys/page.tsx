import { readSettings } from '@saldo/core';
import { formatDayMonth, formatLongDate, localDateOf, wallClock } from '@saldo/i18n';
import { userI18n } from '../../../../src/i18n/server';
import { requireWebUser } from '../../../../src/server/auth/currentUser';
import { listPasskeysForUser } from '../../../../src/server/auth/passkeys';
import { getDb } from '../../../../src/server/db/client';
import { env } from '../../../../src/server/env';
import { loadUserData } from '../../../../src/server/userData/load';
import { resolveTimeZone } from '../../../../src/server/userData/today';
import { Section } from '../../../../src/ui/Section';
import styles from '../../app.module.css';
import { PasskeyList } from './PasskeyList';
import passkeyStyles from './passkeys.module.css';

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
  const addedOn = (iso: string | null) => {
    if (iso === null) return { short: null, long: null };
    const clock = wallClock(timeZone, new Date(iso));
    if (clock === null) return { short: null, long: null };
    const date = localDateOf(clock);
    return {
      short: t('web.passkeys.addedOn', { date: formatDayMonth(date, locale) }),
      long: formatLongDate(date, locale),
    };
  };

  return (
    <Section open title={t('web.passkeys.title')}>
      <div className={passkeyStyles.stack}>
        <p className={styles.body}>{t('web.passkeys.body')}</p>
        <PasskeyList
          passkeys={passkeys.map((passkey) => {
            const added = addedOn(passkey.createdAt);
            return { ...passkey, addedOn: added.short, addedLong: added.long };
          })}
          strings={{
            add: t('web.passkeys.add'),
            provider: t('web.passkeys.providerLabel'),
            added: t('web.passkeys.addedLabel'),
            syncedLabel: t('web.passkeys.syncedLabel'),
            close: t('common.close'),
            inUse: t('web.passkeys.inUse'),
            synced: t('web.passkeys.synced'),
            notSynced: t('web.passkeys.notSynced'),
            unknownProvider: t('web.passkeys.unknownProvider'),
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
      </div>
    </Section>
  );
}
