import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';
import { ApiClientError } from '../net/apiClient';
import type { ServerAuthClient } from './authClient';
import { authorizeUrl, callbackParams, REDIRECT_URI } from './link';

export const healthSchema = z.object({
  app: z.literal('saldo'),
  apiVersion: z.number(),
  schemaVersion: z.number(),
  version: z.string(),
  registrationAllowed: z.boolean(),
  /** §10. Defaulted rather than required, so a server from before this field stays readable. */
  attachmentsEnabled: z.boolean().default(false),
});

export type ServerHealth = z.infer<typeof healthSchema>;

/** §9.3 step 1. Unauthenticated, so it runs before any session exists. */
export async function checkServer(serverUrl: string): Promise<ServerHealth> {
  const response = await fetch(`${serverUrl}/api/health`).catch(() => null);
  if (response === null || !response.ok) {
    throw new ApiClientError(503, 'unreachable', 'Could not reach that address');
  }
  const parsed = healthSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiClientError(502, 'not_saldo', 'That address does not answer like a Saldo server');
  }
  return parsed.data;
}

function randomState(): string {
  return Array.from(Crypto.getRandomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

export interface SignedInUser {
  id: string;
  displayName: string;
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
  const result = await WebBrowser.openAuthSessionAsync(
    authorizeUrl(options.serverUrl, { redirectUri: REDIRECT_URI, state, mode: options.mode }),
    REDIRECT_URI,
  );
  if (result.type !== 'success') {
    throw new ApiClientError(499, 'cancelled', 'Sign-in was cancelled');
  }
  const params = callbackParams(result.url);
  if (params === null) {
    throw new ApiClientError(400, 'bad_callback', 'The server sent no token');
  }
  // A mismatched state means this callback did not come from the request we started.
  if (params.state !== state) {
    throw new ApiClientError(400, 'state_mismatch', 'Sign-in could not be verified');
  }

  const { data, error } = await options.client.oneTimeToken.verify({ token: params.ott });
  if (error !== null || data === null) {
    throw new ApiClientError(
      401,
      'exchange_failed',
      error?.message ?? 'Could not complete sign-in',
    );
  }
  return { id: data.user.id, displayName: data.user.name };
}

/** §9.3 step 7. Revokes server-side, and the Expo client clears its stored session. */
export async function signOut(client: ServerAuthClient): Promise<void> {
  await client.signOut().catch(() => undefined);
}
