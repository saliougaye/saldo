import { userI18n } from '../../../src/i18n/server';
import { requireWebUser } from '../../../src/server/auth/currentUser';
import { SignOutButton } from '../../../src/ui/SignOutButton';
import styles from '../app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A stub until 0.3d builds Home and the top bar around it (plan decision 1). It exists now so that
 * `/`'s redirect is the one §17.1.1 describes and sign-out has somewhere to live.
 */
export default async function HomePage() {
  const user = await requireWebUser();
  const { t } = await userI18n(user.id);
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t('web.home.stubTitle')}</h1>
      <p className={styles.body}>{t('web.home.stubBody')}</p>
      <p className={styles.meta}>
        {t('web.home.signedInAs', { name: user.displayName, email: user.email })}
      </p>
      <p className={styles.links}>
        <a className={styles.link} href="/profile/passkeys">
          {t('web.passkeys.title')}
        </a>
      </p>
      <SignOutButton label={t('sync.signOut')} working={t('common.loading')} />
    </main>
  );
}
