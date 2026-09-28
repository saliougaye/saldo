import { redirect } from 'next/navigation';
import { publicI18n } from '../../../src/i18n/server';
import { currentUser } from '../../../src/server/auth/currentUser';
import { registrationAllowed, registrationRequiresInvite } from '../../../src/server/auth/policy';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { instanceInfo } from '../../../src/server/instance';
import styles from '../auth.module.css';
import { RegisterFlow } from './RegisterFlow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** `/register?invite=CODE` prefills step 2, which is how a link in an invite message works. */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  if ((await currentUser()) !== null) redirect('/home');
  if (!(await registrationAllowed(getDb(), env().registration))) redirect('/login');
  const { t } = await publicI18n();
  const instance = instanceInfo();
  const { invite } = await searchParams;
  return (
    <div className={styles.column}>
      <RegisterFlow
        requiresInvite={registrationRequiresInvite(env().registration)}
        initialInvite={invite ?? ''}
        instance={instance}
        strings={{
          registerTitle: t('web.auth.registerTitle'),
          registerBody: t('web.auth.registerBody'),
          nameLabel: t('web.auth.nameLabel'),
          emailLabel: t('web.auth.emailLabel'),
          emailPlaceholder: t('web.auth.emailPlaceholder'),
          emailHint: t('web.auth.emailHint'),
          emailInvalid: t('web.auth.emailInvalid'),
          inviteTitle: t('web.auth.inviteTitle'),
          inviteBody: t('web.auth.inviteBody'),
          inviteLabel: t('web.auth.inviteLabel'),
          inviteHint: t('web.auth.inviteHint'),
          passkeyTitle: t('web.auth.passkeyTitle'),
          passkeyBody: t('web.auth.passkeyBody'),
          passkeyButton: t('web.auth.passkeyButton'),
          passkeyPhoneHint: t('web.auth.passkeyPhoneHint'),
          continue: t('common.continue'),
          back: t('common.back'),
          working: t('common.loading'),
          haveAccount: t('web.auth.haveAccount'),
          signInLink: t('web.auth.signInLink'),
          // The alerts, by the keys `describeAuthError` answers with.
          'web.auth.emailTakenTitle': t('web.auth.emailTakenTitle'),
          'web.auth.emailTakenBody': t('web.auth.emailTakenBody'),
          'web.auth.invalidInviteTitle': t('web.auth.invalidInviteTitle'),
          'web.auth.invalidInviteBody': t('web.auth.invalidInviteBody'),
          'web.auth.closedTitle': t('web.auth.closedTitle'),
          'web.auth.closedBody': t('web.auth.closedBody'),
          'web.auth.emailInvalid': t('web.auth.emailInvalid'),
          'web.auth.emailHint': t('web.auth.emailHint'),
          'web.auth.genericError': t('web.auth.genericError'),
          'web.auth.crossDeviceHint': t('web.auth.crossDeviceHint'),
          'sync.cancelled': t('sync.cancelled'),
          'web.auth.cancelledBody': t('web.auth.cancelledBody'),
        }}
        // «Passo {{step}} di {{total}}», rendered here because the count is known server-side.
        stepLabels={Array.from(
          { length: registrationRequiresInvite(env().registration) ? 3 : 2 },
          (_, index) =>
            t('common.stepOf', {
              step: index + 1,
              total: registrationRequiresInvite(env().registration) ? 3 : 2,
            }),
        )}
      />
    </div>
  );
}
