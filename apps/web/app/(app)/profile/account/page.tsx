import { emailRowState } from '../../../../src/features/profile/emailRow';
import { currentUser } from '../../../../src/server/auth/currentUser';
import { pendingEmailChange } from '../../../../src/server/auth/emailChange';
import { getDb } from '../../../../src/server/db/client';
import { readPage } from '../../../../src/server/page/context';
import { pageMailEnabled } from '../../../../src/server/page/instanceSettings';
import { Section } from '../../../../src/ui/Section';
import { SummaryRow } from '../../../../src/ui/SummaryRow';
import styles from '../../app.module.css';
import { ChangeEmailForm } from './ChangeEmailForm';
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
  // A real address on a server that can mail: the only case where a change can be proved.
  const pending =
    state === 'verified' || state === 'canVerify'
      ? await pendingEmailChange(getDb(), page.user.id, new Date())
      : null;
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
      {state === 'verified' || state === 'canVerify' ? (
        <ChangeEmailForm
          strings={{
            label: t('web.account.changeLabel'),
            send: t('web.account.changeSend'),
            working: t('common.loading'),
            pending:
              pending === null ? null : t('web.account.changePending', { email: pending.email }),
            sent: pending === null ? null : t('web.account.changeSent', { email: pending.email }),
            cancel: t('web.account.changeCancel'),
            invalid: t('web.account.changeInvalid'),
            same: t('web.account.changeSame'),
            later: t('web.account.changeLater'),
            failed: t('web.auth.genericError'),
          }}
        />
      ) : null}
      {state === 'mailOff' ? <p className={styles.meta}>{t('web.account.mailOff')}</p> : null}
    </Section>
  );
}
