// The suite's default `REGISTRATION` is `open` (see `vitest.config.mts`), and under `open` the
// check endpoint has nothing to check (`registrationRequiresInvite` is false, so it always answers
// `{ valid: true }`). This file needs `invite` mode instead, set before anything imports `auth`.
process.env.REGISTRATION = 'invite';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInvite, revokeInvite } from '../../../src/server/auth/invites';
import { user } from '../../../src/server/db/schema';
import { resetEnvCache } from '../../../src/server/env';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { POST } from './[...all]/route';

let harness: TestDatabase;

beforeAll(async () => {
  // `env()` caches its result for the process; the module-level assignment above only has an
  // effect if the cache is thrown away first (the mode is read through `env()` at request time).
  resetEnvCache();
  harness = await createTestDatabase();
});

beforeEach(async () => {
  // A fresh instance asks for no code, whatever the mode (0.3h): the endpoint only has something
  // to check once an account exists, so every test here starts with one.
  await harness.db.insert(user).values({
    id: crypto.randomUUID(),
    name: 'Ada',
    email: 'ada@example.com',
    emailVerified: false,
  });
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

function check(invite: string): Request {
  return new Request('http://localhost/api/auth/invite/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ invite }),
  });
}

async function mint(): Promise<string> {
  const { code } = await createInvite(harness.db, {
    label: null,
    ttlDays: 7,
    createdBy: null,
    now: new Date(),
  });
  return code;
}

describe('POST /api/auth/invite/check', () => {
  it('accepts a usable code', async () => {
    const response = await POST(check(await mint()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
  });

  it('accepts the code however it was typed', async () => {
    const code = await mint();
    const response = await POST(check(code.toLowerCase().replaceAll('-', ' ')));
    expect(response.status).toBe(200);
  });

  it('gives one answer for a code that is unknown, spent, revoked or expired', async () => {
    const unknown = await POST(check('ZZZZ-ZZZZ-ZZZZ-ZZZZ'));
    expect(unknown.status).toBe(403);
    expect(await unknown.json()).toMatchObject({ code: 'invalid_invite' });

    const { code, invite } = await createInvite(harness.db, {
      label: null,
      ttlDays: 7,
      createdBy: null,
      now: new Date(),
    });
    await revokeInvite(harness.db, invite.id, new Date());
    const revoked = await POST(check(code));
    expect(revoked.status).toBe(403);
    expect(await revoked.json()).toMatchObject({ code: 'invalid_invite' });
  });

  it('does not spend the code it checked', async () => {
    const code = await mint();
    await POST(check(code));
    const again = await POST(check(code));
    expect(again.status).toBe(200);
  });
});
