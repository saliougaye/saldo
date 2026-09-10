import { validateRedirectUri } from '../../../src/server/auth/codes';
import { registrationAllowed } from '../../../src/server/auth/registration';
import { getDb } from '../../../src/server/db/client';
import { env } from '../../../src/server/env';
import { ApiError } from '../../../src/server/http/errors';
import { MobileAuth } from './MobileAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SearchParams {
  redirect_uri?: string;
  code_challenge?: string;
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
 * §9.3 step 4. The page the app opens in a browser session. The parameters are validated **here**,
 * server-side, before any ceremony can start: an unvalidated `redirect_uri` is the one thing in
 * this flow that could hand a code to somebody else.
 */
export default async function MobileAuthPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const redirectUri = params.redirect_uri ?? '';
  const codeChallenge = params.code_challenge ?? '';
  const state = params.state ?? '';
  if (redirectUri === '' || codeChallenge === '' || state === '') {
    return <Problem message="It is missing the redirect, the challenge or the state." />;
  }
  try {
    validateRedirectUri(redirectUri, env().appRedirectSchemes);
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'The redirect target is not allowed.';
    return <Problem message={message} />;
  }
  if (codeChallenge.length < 43 || codeChallenge.length > 128) {
    return <Problem message="The PKCE challenge is malformed." />;
  }

  const canRegister = await registrationAllowed(getDb(), env().registration);
  return (
    <MobileAuth
      redirectUri={redirectUri}
      codeChallenge={codeChallenge}
      state={state}
      canRegister={canRegister}
      initialMode={params.mode === 'register' && canRegister ? 'register' : 'login'}
    />
  );
}
