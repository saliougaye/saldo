import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { log, ms, shortId } from '../log';
import { ApiClientError } from '../net/apiClient';
import type { ServerAuthClient } from './authClient';
import { BUILD_REDIRECT_URI } from './buildServer';
import { readHealth, type ServerHealth } from './health';
import { authorizeUrl, callbackParams } from './link';

export type { ServerHealth } from './health';

/** §9.3 step 1. Unauthenticated, so it runs before any session exists. */
export async function checkServer(serverUrl: string): Promise<ServerHealth> {
  const startedAt = Date.now();
  const response = await fetch(`${serverUrl}/api/health`).catch(() => null);
  const body = response === null ? null : await response.json().catch(() => null);
  const reading = readHealth(response?.status ?? null, body);
  if (reading.kind === 'unreachable') {
    log('auth', `${serverUrl} is not reachable`, { status: response?.status ?? 'no answer' });
    throw new ApiClientError(503, 'unreachable', 'Could not reach that address');
  }
  if (reading.kind === 'not_saldo') {
    log('auth', `${serverUrl} answered, but not like a Saldo server`, { status: response?.status });
    throw new ApiClientError(502, 'not_saldo', 'That address does not answer like a Saldo server');
  }
  const { health } = reading;
  // Both versions and both switches: they decide what the app is allowed to offer, and getting
  // them wrong looks like the app misbehaving rather than the server being configured that way.
  log('auth', `${serverUrl} is a Saldo server (${ms(startedAt)})`, {
    version: health.version,
    api: health.apiVersion,
    schema: health.schemaVersion,
    registrationAllowed: health.registrationAllowed,
    attachments: health.attachmentsEnabled,
  });
  return health;
}

function randomState(): string {
  return Array.from(Crypto.getRandomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export interface SignedInUser {
  id: string;
  displayName: string;
  /** Synthetic (`@passkey.saldo.invalid`) until the account is given a real one (D32). */
  email: string;
}

/**
 * §9.3 steps 3–5, over Better Auth. The ceremony runs on the server's page because WebAuthn needs
 * a browser; it comes back with a one-time token, and exchanging that token is what installs the
 * session in SecureStore — the Expo client stores it from the response itself.
 */
export async function signIn(options: {
  serverUrl: string;
  client: ServerAuthClient;
  mode: 'login' | 'register';
}): Promise<SignedInUser> {
  const state = randomState();
  const startedAt = Date.now();
  const url = authorizeUrl(options.serverUrl, {
    redirectUri: BUILD_REDIRECT_URI,
    state,
    mode: options.mode,
  });
  log('auth', `opening the browser at ${url}`);
  const result = await WebBrowser.openAuthSessionAsync(url, BUILD_REDIRECT_URI);
  // `dismiss` (the sheet was swiped away) and `cancel` both arrive here, and they are the two
  // outcomes a user reports as "nothing happened".
  log('auth', `the browser closed with "${result.type}" after ${ms(startedAt)}`);
  if (result.type !== 'success') {
    throw new ApiClientError(499, 'cancelled', 'Sign-in was cancelled');
  }
  const params = callbackParams(result.url);
  if (params === null) {
    log('auth', 'the callback carried no token', { url: result.url.split('?')[0] });
    throw new ApiClientError(400, 'bad_callback', 'The server sent no token');
  }
  // A mismatched state means this callback did not come from the request we started.
  if (params.state !== state) {
    log('auth', 'the callback belongs to a different sign-in attempt');
    throw new ApiClientError(400, 'state_mismatch', 'Sign-in could not be verified');
  }

  log('auth', 'exchanging the handoff token');
  const { data, error } = await options.client.oneTimeToken.verify({ token: params.ott });
  if (error !== null || data === null) {
    log('auth', 'the handoff token was refused', { message: error?.message ?? 'no data' });
    throw new ApiClientError(
      401,
      'exchange_failed',
      error?.message ?? 'Could not complete sign-in',
    );
  }
  log('auth', `signed in as ${shortId(data.user.id)} in ${ms(startedAt)}`);
  return { id: data.user.id, displayName: data.user.name, email: data.user.email };
}

/** §9.3 step 7. Revokes server-side, and the Expo client clears its stored session. */
export async function signOut(client: ServerAuthClient): Promise<void> {
  await client.signOut().catch(() => undefined);
}
