import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../../../../../src/server/auth/rateLimit';
import {
  authCodes,
  passkeys,
  users,
  webauthnChallenges,
} from '../../../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../../../src/server/test/harness';

const verifyAuthenticationResponse = vi.fn();

vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: (...args: unknown[]) => verifyAuthenticationResponse(...args),
}));

const { POST } = await import('./route');

let harness: TestDatabase;
const VERIFIER = 'a'.repeat(64);
const CODE_CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

function assertion(challenge: string, credentialId = 'Y3JlZC1pZA') {
  const clientDataJSON = Buffer.from(JSON.stringify({ challenge, type: 'webauthn.get' })).toString(
    'base64url',
  );
  return {
    id: credentialId,
    rawId: credentialId,
    type: 'public-key',
    clientExtensionResults: {},
    response: { clientDataJSON, authenticatorData: 'YXV0aA', signature: 'c2ln' },
  };
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/auth/login/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function seedPasskey(): Promise<string> {
  const [user] = await harness.db.insert(users).values({ displayName: 'Ada' }).returning();
  if (user === undefined) throw new Error('insert returned no row');
  await harness.db.insert(passkeys).values({
    id: 'Y3JlZC1pZA',
    userId: user.id,
    publicKey: new Uint8Array([9, 8, 7]),
    counter: 3,
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
  });
  return user.id;
}

async function storeChallenge(challenge = 'login-challenge'): Promise<string> {
  await harness.db.insert(webauthnChallenges).values({
    challenge,
    kind: 'login',
    expiresAt: new Date(Date.now() + 60_000),
  });
  return challenge;
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(() => {
  resetRateLimits();
  verifyAuthenticationResponse.mockReset();
  verifyAuthenticationResponse.mockResolvedValue({
    verified: true,
    authenticationInfo: { credentialID: 'Y3JlZC1pZA', newCounter: 4 },
  });
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('POST /api/auth/login/verify', () => {
  it('signs in, bumps the counter and mints a code', async () => {
    await seedPasskey();
    const challenge = await storeChallenge();
    const response = await POST(
      post({
        response: assertion(challenge),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'saldo://auth/callback',
        state: 'st4te',
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { redirect: string };
    expect(body.redirect).toContain('saldo://auth/callback?code=');
    expect(await harness.db.select().from(authCodes)).toHaveLength(1);

    const [key] = await harness.db.select().from(passkeys).where(eq(passkeys.id, 'Y3JlZC1pZA'));
    expect(key?.counter).toBe(4);
    expect(key?.lastUsedAt).not.toBeNull();
  });

  it('answers invalid_credentials for an unknown credential, revealing nothing', async () => {
    const challenge = await storeChallenge();
    const response = await POST(
      post({
        response: assertion(challenge, 'dW5rbm93bg'),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'saldo://auth/callback',
        state: 's',
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'invalid_credentials', message: 'Could not sign you in' },
    });
  });

  it('answers invalid_credentials when the signature does not verify', async () => {
    await seedPasskey();
    verifyAuthenticationResponse.mockResolvedValue({
      verified: false,
      authenticationInfo: { credentialID: 'Y3JlZC1pZA', newCounter: 0 },
    });
    const challenge = await storeChallenge();
    const response = await POST(
      post({
        response: assertion(challenge),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'saldo://auth/callback',
        state: 's',
      }),
    );
    expect(response.status).toBe(401);
    expect(await harness.db.select().from(authCodes)).toEqual([]);
  });

  it('refuses a redirect_uri outside the allow-list', async () => {
    await seedPasskey();
    const challenge = await storeChallenge();
    const response = await POST(
      post({
        response: assertion(challenge),
        code_challenge: CODE_CHALLENGE,
        redirect_uri: 'https://evil.example/cb',
        state: 's',
      }),
    );
    expect(response.status).toBe(400);
  });
});
