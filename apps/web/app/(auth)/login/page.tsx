import { redirect } from 'next/navigation';
import { publicI18n } from '../../../src/i18n/server';
import { currentUser } from '../../../src/server/auth/currentUser';
import { registrationAllowed } from '../../../src/server/auth/policy';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { instanceInfo } from '../../../src/server/instance';
import { Alert } from '../../../src/ui/Alert';
import { AuthFooter, Brand } from '../../../src/ui/Brand';
import styles from '../auth.module.css';
import { LoginForm } from './LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** §17.1.1: `/login` for a browser with no session. One already signed in has nothing to do here. */
export default async function LoginPage() {
  if ((await currentUser()) !== null) redirect('/home');
  const { t } = await publicI18n();
  const instance = instanceInfo();
  const canRegister = await registrationAllowed(getDb(), env().registration ?? 'first-user');
  return (
    <div className={styles.column}>
      {/* D26: Rocky is the welcome, and appears on this page only — never beside an error. */}
      {/* biome-ignore lint/performance/noImgElement: decision 10 — a plain static PNG, no next/image
          optimizer (which this standalone Docker build ships with no sharp binary) for one 96px mascot. */}
      <img className={styles.rocky} src="/rocky/idle.png" alt="" width={96} height={96} />
      <Brand instanceName={instance.name} />
      <h1 className={styles.title}>{t('web.auth.signInTitle')}</h1>
      <p className={styles.lede}>{t('web.auth.signInBody')}</p>
      <LoginForm
        strings={{
          emailLabel: t('web.auth.emailLabel'),
          emailPlaceholder: t('web.auth.emailPlaceholder'),
          signIn: t('sync.signIn'),
          working: t('common.loading'),
          crossDeviceHint: t('web.auth.crossDeviceHint'),
          cancelledTitle: t('sync.cancelled'),
          cancelledBody: t('web.auth.cancelledBody'),
          genericTitle: t('web.auth.genericError'),
          genericBody: t('web.auth.crossDeviceHint'),
        }}
      />
      <div className={styles.or}>{t('web.auth.or')}</div>
      {canRegister ? (
        <a className={styles.secondaryLink} href="/register">
          {t('sync.createAccount')}
        </a>
      ) : (
        <Alert title={t('web.auth.closedTitle')} body={t('web.auth.closedBody')} />
      )}
      <AuthFooter version={instance.version} host={instance.host} />
    </div>
  );
}
