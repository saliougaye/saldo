import { publicI18n } from '../../../src/i18n/server';
import { registrationAllowed, registrationRequiresInvite } from '../../../src/server/auth/policy';
import { validateRedirectUri } from '../../../src/server/auth/redirect';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { ApiError } from '../../../src/server/http/errors';
import { instanceInfo } from '../../../src/server/instance';
import { log } from '../../../src/server/log';
import { Alert } from '../../../src/ui/Alert';
import { Brand } from '../../../src/ui/Brand';
import authStyles from '../../(auth)/auth.module.css';
import { MobileAuth } from './MobileAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchParams {
  redirect_uri?: string;
  state?: string;
  mode?: string;
}

/**
 * §9.3 step 4. The parameters are validated **here**, server-side, before any ceremony can start: an
 * unvalidated `redirect_uri` is the one thing in this flow that could hand the handoff token to
 * somebody else.
 */
export default async function MobileAuthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { t } = await publicI18n();
  const instance = instanceInfo();
  const params = await searchParams;
  const redirectUri = params.redirect_uri ?? '';
  const state = params.state ?? '';

  const problem = (message: string) => (
    <main className={authStyles.page}>
      <div className={authStyles.column}>
        <Brand instanceName={instance.name} />
        <Alert title={t('web.auth.linkUnusableTitle')} body={message} />
      </div>
    </main>
  );

  if (redirectUri === '' || state === '') {
    log('auth', 'a sign-in link arrived without a redirect or a state');
    return problem(t('web.auth.linkMissing'));
  }
  try {
    validateRedirectUri(redirectUri, env().appRedirectSchemes);
  } catch (error) {
    // The one rejection a self-hoster hits by configuration rather than by mistake: a build whose
    // scheme is not in APP_REDIRECT_SCHEMES gets here and the phone only sees a dead page.
    log(
      'auth',
      `a sign-in link was refused: ${redirectUri.split(':')[0]} is not an allowed scheme`,
      {
        allowed: env().appRedirectSchemes,
      },
    );
    return problem(error instanceof ApiError ? error.message : t('web.auth.genericError'));
  }

  const canRegister = await registrationAllowed(getDb(), env().registration);
  const requiresInvite = registrationRequiresInvite(env().registration);
  log('auth', 'serving the sign-in page', {
    registration: env().registration,
    canRegister,
    requiresInvite,
  });
  const total = requiresInvite ? 3 : 2;
  return (
    <main className={authStyles.page}>
      <div className={authStyles.column}>
        <MobileAuth
          redirectUri={redirectUri}
          state={state}
          canRegister={canRegister}
          requiresInvite={requiresInvite}
          initialMode={params.mode === 'register' && canRegister ? 'register' : 'login'}
          instance={instance}
          strings={{
            signInTitle: t('web.auth.mobileSignInTitle'),
            signInBody: t('web.auth.mobileSignInBody'),
            signIn: t('sync.signIn'),
            createAccount: t('sync.createAccount'),
            or: t('web.auth.or'),
            doneTitle: t('web.auth.mobileDoneTitle'),
            doneBody: t('web.auth.mobileDoneBody'),
            crossDeviceHint: t('web.auth.crossDeviceHint'),
            registerTitle: t('web.auth.registerTitle'),
            registerBody: t('web.auth.registerBody'),
            nameLabel: t('web.auth.nameLabel'),
            emailLabel: t('web.auth.emailLabel'),
            emailPlaceholder: t('web.auth.emailPlaceholder'),
            emailHint: t('web.auth.emailHint'),
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
            retry: t('common.retry'),
            'web.auth.nameRequiredTitle': t('web.auth.nameRequiredTitle'),
            'web.auth.nameRequiredBody': t('web.auth.nameRequiredBody'),
            'web.auth.handoffFailedTitle': t('web.auth.handoffFailedTitle'),
            'web.auth.handoffFailedBody': t('web.auth.handoffFailedBody'),
            'sync.cancelled': t('sync.cancelled'),
            'web.auth.cancelledBody': t('web.auth.cancelledBody'),
          }}
          stepLabels={Array.from({ length: total }, (_, index) =>
            t('common.stepOf', { step: index + 1, total }),
          )}
        />
      </div>
    </main>
  );
}
