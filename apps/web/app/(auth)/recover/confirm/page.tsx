import { redirect } from 'next/navigation';
import { RECOVERY_ERROR_PATH } from '../../../../src/features/auth/recoverView';
import { publicI18n } from '../../../../src/i18n/server';
import { pageInstanceInfo } from '../../../../src/server/page/instanceSettings';
import { AuthFooter, Brand } from '../../../../src/ui/Brand';
import styles from '../../auth.module.css';
import { ConfirmForm } from './ConfirmForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where the link in the recovery mail points (0.3f-3 review, finding C). Better Auth's own
 * `/magic-link/verify` is a GET that spends the token and sets the session, so a mail scanner that
 * follows links would burn the link and be handed the session, and a stranger could make a victim's
 * browser sign in to the stranger's account with one cross-site GET. This page **consumes
 * nothing**: it asks, and only the button (a person) opens the verify URL. It does not show the
 * address either, so whoever merely loads it learns nothing about whose link it is.
 */
export default async function RecoverConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (token === undefined || token === '') redirect(`${RECOVERY_ERROR_PATH}?error=INVALID_TOKEN`);
  const { t } = await publicI18n();
  const instance = await pageInstanceInfo();
  return (
    <div className={styles.column}>
      <Brand instanceName={instance.name} />
      <h1 className={styles.title}>{t('web.auth.recoverConfirmTitle')}</h1>
      <p className={styles.lede}>{t('web.auth.recoverConfirmBody')}</p>
      <ConfirmForm
        token={token}
        strings={{
          confirm: t('web.auth.recoverConfirmButton'),
          working: t('common.loading'),
        }}
      />
      <AuthFooter version={instance.version} host={instance.host} />
    </div>
  );
}
