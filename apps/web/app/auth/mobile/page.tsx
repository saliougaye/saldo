import { registrationAllowed, registrationRequiresInvite } from '../../../src/server/auth/policy';
import { validateRedirectUri } from '../../../src/server/auth/redirect';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { ApiError } from '../../../src/server/http/errors';
import { log } from '../../../src/server/log';
import { MobileAuth } from './MobileAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchParams {
  redirect_uri?: string;
  state?: string;
  mode?: string;
}

function Problem({ message }: { message: string }) {
  return (
    <main style={{ padding: 32, maxWidth: 420, textAlign: 'center' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>This link is not usable</h1>
      <p style={{ color: '#8C8C8C' }}>{message}</p>
    </main>
  );
}

/**
 * §9.3 step 4. The page the app opens in a browser session, because a passkey ceremony needs
 * `navigator.credentials` and React Native has no equivalent (§9.4).
 *
 * The parameters are validated **here**, server-side, before any ceremony can start: an
 * unvalidated `redirect_uri` is the one thing in this flow that could hand the handoff token to
 * somebody else.
 */
export default async function MobileAuthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const redirectUri = params.redirect_uri ?? '';
  const state = params.state ?? '';
  if (redirectUri === '' || state === '') {
    log('auth', 'a sign-in link arrived without a redirect or a state');
    return <Problem message="It is missing the redirect or the state." />;
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
    const message =
      error instanceof ApiError ? error.message : 'The redirect target is not allowed.';
    return <Problem message={message} />;
  }

  const canRegister = await registrationAllowed(getDb(), env().registration);
  log('auth', 'serving the sign-in page', {
    registration: env().registration,
    canRegister,
    requiresInvite: registrationRequiresInvite(env().registration),
  });
  return (
    <MobileAuth
      redirectUri={redirectUri}
      state={state}
      canRegister={canRegister}
      requiresInvite={registrationRequiresInvite(env().registration)}
      initialMode={params.mode === 'register' && canRegister ? 'register' : 'login'}
    />
  );
}
