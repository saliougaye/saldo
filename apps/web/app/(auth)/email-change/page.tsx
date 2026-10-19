import { redirect } from 'next/navigation';
import { publicI18n } from '../../../src/i18n/server';
import { pageInstanceInfo } from '../../../src/server/page/instanceSettings';
import { AuthFooter, Brand } from '../../../src/ui/Brand';
import styles from '../auth.module.css';
import { ConfirmForm } from './ConfirmForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where the link in the change-of-address mail points. Public: the person opens it in whatever browser
 * their mail app picks, with no session, and nothing here creates one. The page **consumes nothing**:
 * a mail scanner or another site that loads it cannot spend the link; only the button (a person)
 * posts the token to `/api/email-change/confirm`. It does not show either address.
 */
export default async function EmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (token === undefined || token === '') redirect('/login');
  const { t } = await publicI18n();
  const instance = await pageInstanceInfo();
  return (
    <div className={styles.column}>
      <Brand instanceName={instance.name} />
      <ConfirmForm
        token={token}
        strings={{
          title: t('web.auth.emailChangeTitle'),
          body: t('web.auth.emailChangeBody'),
          confirm: t('web.auth.emailChangeButton'),
          working: t('common.loading'),
          doneTitle: t('web.auth.emailChangeDoneTitle'),
          doneBody: t('web.auth.emailChangeDoneBody'),
          open: t('web.auth.emailVerifiedOpen'),
          invalidTitle: t('web.auth.emailLinkInvalidTitle'),
          invalidBody: t('web.auth.emailLinkInvalidBody'),
        }}
      />
      <AuthFooter version={instance.version} host={instance.host} />
    </div>
  );
}
