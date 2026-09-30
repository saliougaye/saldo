import { emailRowState } from '../../../../src/features/profile/emailRow';
import { currentUser } from '../../../../src/server/auth/currentUser';
import { readPage } from '../../../../src/server/page/context';
import { pageMailEnabled } from '../../../../src/server/page/instanceSettings';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../../app.module.css';
import { VerifyEmailButton } from './VerifyEmailButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ProfileAccountPage() {
  const page = await readPage(Promise.resolve({}));
  const { t } = page;
  // `currentUser` is the request's cached session read; `readPage` already went through it.
  const verified = (await currentUser())?.emailVerified ?? false;
  const state = emailRowState({
    email: page.user.email,
    emailVerified: verified,
    mailEnabled: await pageMailEnabled(),
  });
  return (
    <Section open title={t('profile.title')}>
      <SummaryRow title={t('web.auth.nameLabel')} value={page.user.displayName} />
      <SummaryRow
        title={t('web.auth.emailLabel')}
        value={page.user.email}
        subtitle={
          state === 'synthetic'
            ? undefined
            : t(state === 'verified' ? 'web.account.verified' : 'web.account.unverified')
        }
      />
      {state === 'canVerify' ? (
        <VerifyEmailButton
          email={page.user.email}
          strings={{
            send: t('web.account.verify'),
            working: t('common.loading'),
            sent: t('web.account.verifySent', { email: page.user.email }),
            failed: t('web.auth.genericError'),
          }}
        />
      ) : null}
      {state === 'mailOff' ? <p className={styles.meta}>{t('web.account.mailOff')}</p> : null}
    </Section>
  );
}
