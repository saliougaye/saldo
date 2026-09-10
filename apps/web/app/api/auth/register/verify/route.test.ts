import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../../../../../src/server/auth/rateLimit';
import {
  authCodes,
  passkeys,
  users,
  webauthnChallenges,
} from '../../../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../../../src/server/test/harness';

const verifyRegistrationResponse = vi.fn();

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: (...args: unknown[]) => verifyRegistrationResponse(...args),
  verifyAuthenticationResponse: vi.fn(),
}));

const { POST } = await import('./route');

let harness: TestDatabase;
const VERIFIER = 'a'.repeat(64);
const CODE_CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

/** A minimal attestation response whose clientDataJSON carries the challenge we stored. */
function attestation(challenge: string) {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ challenge, type: 'webauthn.create' }),
  ).toString('base64url');
  return {
    id: 'Y3JlZC1pZA',
    rawId: 'Y3JlZC1pZA',
    type: 'public-key',
    clientExtensionResults: {},
    response: { clientDataJSON, attestationObject: 'YXR0' },
  };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/auth/register/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function storeChallenge(challenge = 'reg-challenge'): Promise<string> {
  await harness.db.insert(webauthnChallenges).values({
    challenge,
    kind: 'register',
    displayName: 'Ada',
    expiresAt: new Date(Date.now() + 60_000),
  });
  return challenge;
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(() => {
  resetRateLimits();
  verifyRegistrationResponse.mockReset();
  verifyRegistrationResponse.mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: {
        id: 'Y3JlZC1pZA',
        publicKey: new Uint8Array([9, 8, 7]),
        counter: 0,
        transports: ['internal'],
      },
      credentialDeviceType: 'multiDevice',
      credentialBackedUp: true,
    },
  });
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('POST /api/auth/register/verify', () => {
  it('creates the user, stores the passkey and returns a redirect carrying a code', async () => {
    const challenge = await storeChallenge();
    const response = await POST(
      post({
        response: attestation(challenge),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'saldo://auth/callback',
        state: 'st4te',
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { redirect: string };
    expect(body.redirect).toMatch(/^saldo:\/\/auth\/callback\?code=.+&state=st4te$/);

    const [user] = await harness.db.select().from(users);
    expect(user).toMatchObject({ displayName: 'Ada' });
    const [key] = await harness.db.select().from(passkeys);
    expect(key).toMatchObject({ id: 'Y3JlZC1pZA', counter: 0, backedUp: true });
    expect(await harness.db.select().from(authCodes)).toHaveLength(1);
    // The challenge is gone: single use.
    expect(await harness.db.select().from(webauthnChallenges)).toEqual([]);
  });

  it('refuses a redirect_uri outside the allow-list, before touching the database', async () => {
    const challenge = await storeChallenge();
    const response = await POST(
      post({
        response: attestation(challenge),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'https://evil.example/cb',
        state: 's',
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_redirect_uri' },
    });
    expect(await harness.db.select().from(users)).toEqual([]);
  });

  it('refuses an unknown challenge', async () => {
    const response = await POST(
      post({
        response: attestation('never-stored'),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'saldo://auth/callback',
        state: 's',
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'challenge_not_found' },
    });
  });

  it('creates nothing when the attestation does not verify', async () => {
    verifyRegistrationResponse.mockResolvedValue({ verified: false });
    const challenge = await storeChallenge();
    const response = await POST(
      post({
        response: attestation(challenge),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'saldo://auth/callback',
        state: 's',
      }),
    );
    expect(response.status).toBe(400);
    expect(await harness.db.select().from(users)).toEqual([]);
  });

  it('refuses when registration is closed', async () => {
    const { resetEnvCache } = await import('../../../../../src/server/env');
    vi.stubEnv('REGISTRATION', 'closed');
    resetEnvCache();
    try {
      const challenge = await storeChallenge();
      const response = await POST(
        post({
          response: attestation(challenge),
          code_challenge: CODE_CHALLENGE,
          redirect_uri: 'saldo://auth/callback',
          state: 's',
        }),
      );
      expect(response.status).toBe(403);
    } finally {
      vi.unstubAllEnvs();
      resetEnvCache();
    }
  });
});
