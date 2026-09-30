import { recoverState } from '../../../src/features/auth/recoverView';
import { publicI18n } from '../../../src/i18n/server';
import { pageInstanceInfo, pageMailEnabled } from '../../../src/server/page/instanceSettings';
import { Alert } from '../../../src/ui/Alert';
import { AuthFooter, Brand } from '../../../src/ui/Brand';
import styles from '../auth.module.css';
import { RecoverForm } from './RecoverForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §17.1.4 (0.3f-3): the way back for somebody who lost their passkey, on an instance whose admin
 * configured SMTP. `?error=link` is where Better Auth sends a link that expired or was used.
 */
export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await publicI18n();
  const instance = await pageInstanceInfo();
  const { error } = await searchParams;
  const state = recoverState({ mailEnabled: await pageMailEnabled(), error });
  return (
    <div className={styles.column}>
      <Brand instanceName={instance.name} />
      <h1 className={styles.title}>{t('web.auth.recoverTitle')}</h1>
      {state === 'unavailable' ? (
        <>
          <Alert title={t('web.auth.recoverOffTitle')} body={t('web.auth.recoverOffBody')} />
          <a className={styles.secondaryLink} href="/login">
            {t('web.auth.backToSignIn')}
          </a>
        </>
      ) : (
        <>
          {state === 'expiredLink' ? (
            <Alert
              title={t('web.auth.recoverExpiredTitle')}
              body={t('web.auth.recoverExpiredBody')}
            />
          ) : (
            <p className={styles.lede}>{t('web.auth.recoverBody')}</p>
          )}
          <RecoverForm
            strings={{
              emailLabel: t('web.auth.emailLabel'),
              emailPlaceholder: t('web.auth.emailPlaceholder'),
              submit: t('web.auth.recoverSubmit'),
              working: t('common.loading'),
              sent: t('web.auth.recoverSent'),
              rateLimited: t('web.auth.recoverRateLimited'),
              backToSignIn: t('web.auth.backToSignIn'),
            }}
          />
        </>
      )}
      <AuthFooter version={instance.version} host={instance.host} />
    </div>
  );
}
