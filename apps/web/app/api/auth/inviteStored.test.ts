// `REGISTRATION` is unset here: the mode is the one saved in `server_settings`, and it is saved
// **after** the Better Auth instance exists, which is what the invite plugin's getter is for.
const previous = process.env.REGISTRATION;
delete process.env.REGISTRATION;

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resetAuthForTests } from '../../../src/server/auth/auth';
import { serverSettings } from '../../../src/server/db/schema';
import { resetEnvCache } from '../../../src/server/env';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { POST } from './[...all]/route';

let harness: TestDatabase;

beforeAll(async () => {
  resetEnvCache();
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
  if (previous === undefined) delete process.env.REGISTRATION;
  else process.env.REGISTRATION = previous;
  resetEnvCache();
  resetAuthForTests();
});

const check = (invite: string) =>
  POST(
    new Request('http://localhost/api/auth/invite/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite }),
    }),
  );

describe('POST /api/auth/invite/check with the mode stored in the table', () => {
  it('has nothing to check until the saved mode asks for a code, and then checks', async () => {
    expect((await check('ZZZZ-ZZZZ-ZZZZ-ZZZZ')).status).toBe(200);

    await harness.db
      .insert(serverSettings)
      .values({ key: 'registration', value: 'invite', updatedAt: new Date(), updatedBy: null });
    const refused = await check('ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: 'invalid_invite' });
  });
});
