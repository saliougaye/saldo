import { publicI18n } from '../../../src/i18n/server';
import { pageInstanceInfo } from '../../../src/server/page/instanceSettings';
import { Alert } from '../../../src/ui/Alert';
import { AuthFooter, Brand } from '../../../src/ui/Brand';
import { Icon } from '../../../src/ui/Icon';
import styles from '../auth.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where the link in the verification mail ends (its `callbackURL`). Public: a phone-only user lands
 * here in whatever browser their mail app opens, with no session — opening the link signs nobody in.
 * Better Auth appends `?error=` when the token is expired or invalid, whatever its code.
 */
export default async function EmailVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await publicI18n();
  const instance = await pageInstanceInfo();
  const { error } = await searchParams;
  return (
    <div className={styles.column}>
      <Brand instanceName={instance.name} />
      {error === undefined ? (
        <>
          <div className={styles.done}>
            <div className={styles.check}>
              <Icon name="check" size={28} />
            </div>
            <h1 className={styles.title}>{t('web.auth.emailVerifiedTitle')}</h1>
            <p className={styles.lede}>{t('web.auth.emailVerifiedBody')}</p>
          </div>
          <a className={styles.secondaryLink} href="/home">
            {t('web.auth.emailVerifiedOpen')}
          </a>
        </>
      ) : (
        <Alert
          title={t('web.auth.emailLinkInvalidTitle')}
          body={t('web.auth.emailLinkInvalidBody')}
        />
      )}
      <AuthFooter version={instance.version} host={instance.host} />
    </div>
  );
}
