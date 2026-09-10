import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { env } from '../env';
import { ApiError } from '../http/errors';

/**
 * The one place that talks to `@simplewebauthn/server`, so the ceremony parameters of §9.3 live
 * together: resident (discoverable) credentials are required — login sends an empty
 * `allowCredentials` and lets the authenticator name the user — and attestation is not collected.
 */
export function registrationOptions(
  displayName: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpId, rpName } = env();
  return generateRegistrationOptions({
    rpID: rpId,
    rpName,
    userName: displayName,
    userDisplayName: displayName,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
}

export function authenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: env().rpId,
    allowCredentials: [],
    userVerification: 'preferred',
  });
}

export interface VerifiedRegistration {
  credentialId: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: string[] | null;
  deviceType: string;
  backedUp: boolean;
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
): Promise<VerifiedRegistration> {
  const { publicUrl, rpId } = env();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: publicUrl,
    expectedRPID: rpId,
  });
  if (!result.verified) {
    throw new ApiError(400, 'registration_failed', 'The passkey could not be verified');
  }
  const info = result.registrationInfo;
  return {
    credentialId: info.credential.id,
    publicKey: info.credential.publicKey,
    counter: info.credential.counter,
    transports: info.credential.transports ?? null,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
  };
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credential: {
    id: string;
    publicKey: Uint8Array<ArrayBuffer>;
    counter: number;
    transports: string[] | null;
  },
): Promise<{ newCounter: number }> {
  const { publicUrl, rpId } = env();
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: publicUrl,
    expectedRPID: rpId,
    credential: {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      ...(credential.transports === null ? {} : { transports: credential.transports }),
    },
  });
  // §18: no user enumeration — a wrong signature reads exactly like an unknown credential.
  if (!result.verified) {
    throw new ApiError(401, 'invalid_credentials', 'Could not sign you in');
  }
  return { newCounter: result.authenticationInfo.newCounter };
}

/**
 * The challenge the browser actually signed, read back out of `clientDataJSON`. It is what lets a
 * ceremony be looked up in `webauthn_challenges` without a cookie or a session.
 */
export function challengeFromClientData(clientDataJSON: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8'));
  } catch {
    throw new ApiError(400, 'invalid_body', 'clientDataJSON is not valid');
  }
  const challenge =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as { challenge?: unknown }).challenge
      : undefined;
  if (typeof challenge !== 'string' || challenge.length === 0) {
    throw new ApiError(400, 'invalid_body', 'clientDataJSON carries no challenge');
  }
  return challenge;
}
