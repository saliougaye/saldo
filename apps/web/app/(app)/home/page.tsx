import { userI18n } from '../../../src/i18n/server';
import { requireWebUser } from '../../../src/server/auth/currentUser';
import { SignOutButton } from '../../../src/ui/SignOutButton';
import styles from '../app.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A stub until Task 12 builds Home (plan decision 1). The `(app)` layout supplies the `<main>` and
 * the page frame, so this renders its own content and nothing around it.
 */
export default async function HomePage() {
  const user = await requireWebUser();
  const { t } = await userI18n(user.id);
  return (
    <>
      <h1 className={styles.title}>{t('web.home.stubTitle')}</h1>
      <p className={styles.body}>{t('web.home.stubBody')}</p>
      <p className={styles.meta}>
        {t('web.home.signedInAs', { name: user.displayName, email: user.email })}
      </p>
      <SignOutButton label={t('sync.signOut')} working={t('common.loading')} />
    </>
  );
}
