import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAuthCode } from '../../../../src/server/auth/codes';
import { resetRateLimits } from '../../../../src/server/auth/rateLimit';
import { users } from '../../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../../src/server/test/harness';
import { POST } from './route';

let harness: TestDatabase;
const VERIFIER = 'a'.repeat(64);
const CODE_CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

function post(body: unknown): Request {
  return new Request('http://localhost/api/auth/token', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function mintCode(): Promise<{ code: string; userId: string }> {
  const [user] = await harness.db.insert(users).values({ displayName: 'Ada' }).returning();
  if (user === undefined) throw new Error('insert returned no row');
  const { code } = await createAuthCode(
    harness.db,
    {
      userId: user.id,
      codeChallenge: CODE_CHALLENGE,
      redirectUri: 'saldo://auth/callback',
      state: 's',
    },
    new Date(),
  );
  return { code, userId: user.id };
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(() => {
  resetRateLimits();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('POST /api/auth/token — authorization_code', () => {
  it('exchanges a code for a token pair and the user', async () => {
    const { code, userId } = await mintCode();
    const response = await POST(
      post({
        grant_type: 'authorization_code',
        code,
        code_verifier: VERIFIER,
        device_name: 'iPhone 16',
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ expires_in: 900, user: { id: userId, displayName: 'Ada' } });
    expect(typeof body.access_token).toBe('string');
    expect(typeof body.refresh_token).toBe('string');
  });

  it('rejects a mismatched verifier', async () => {
    const { code } = await mintCode();
    const response = await POST(
      post({
        grant_type: 'authorization_code',
        code,
        code_verifier: 'b'.repeat(64),
        device_name: 'iPhone',
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_grant' } });
  });

  it('rejects a code that was already exchanged', async () => {
    const { code } = await mintCode();
    const body = {
      grant_type: 'authorization_code',
      code,
      code_verifier: VERIFIER,
      device_name: 'iPhone',
    };
    expect((await POST(post(body))).status).toBe(200);
    expect((await POST(post(body))).status).toBe(400);
  });
});

describe('POST /api/auth/token — refresh_token', () => {
  it('rotates and kills the chain when a replaced token comes back', async () => {
    const { code } = await mintCode();
    const first = (await (
      await POST(
        post({
          grant_type: 'authorization_code',
          code,
          code_verifier: VERIFIER,
          device_name: 'iPhone',
        }),
      )
    ).json()) as { refresh_token: string };

    const rotated = await POST(
      post({ grant_type: 'refresh_token', refresh_token: first.refresh_token }),
    );
    expect(rotated.status).toBe(200);
    const next = (await rotated.json()) as { refresh_token: string };
    expect(next.refresh_token).not.toBe(first.refresh_token);

    const reused = await POST(
      post({ grant_type: 'refresh_token', refresh_token: first.refresh_token }),
    );
    expect(reused.status).toBe(401);
    // The chain died with the reuse, so the rotated token is dead too.
    const after = await POST(
      post({ grant_type: 'refresh_token', refresh_token: next.refresh_token }),
    );
    expect(after.status).toBe(401);
  });

  it('rejects an unknown grant type', async () => {
    const response = await POST(post({ grant_type: 'password' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_body' } });
  });
});
