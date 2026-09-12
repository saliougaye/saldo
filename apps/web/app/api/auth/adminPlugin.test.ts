import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_ROLE, revokeUser } from '../../../src/server/auth/admin';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';
import { GET, POST } from './[...all]/route';

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

function listUsers(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/admin/list-users?limit=10', { headers });
}

function createUser(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/admin/create-user', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      name: 'Uninvited',
      email: 'uninvited@example.com',
      password: 'not-a-real-password',
      role: ADMIN_ROLE,
    }),
  });
}

/**
 * §9.5 buys `user.role` and `user.banned` from better-auth's `admin` plugin, and the plugin brings
 * its own endpoints along with them, served from the catch-all at `/api/auth/[...all]`. Saldo calls
 * none of them — access is managed through `/api/invites` and the CLI — but they are reachable, so
 * what they do for somebody who is *not* an admin is part of this application's attack surface and
 * is pinned here.
 *
 * `create-user` is the one that matters most: it would write an account with no invite, no burn
 * and no row in `invites`, which is the one thing §9.5 promises cannot happen.
 */
describe("better-auth's own admin endpoints", () => {
  it('refuses an anonymous caller', async () => {
    expect((await GET(listUsers())).status).not.toBe(200);
    expect((await POST(createUser())).status).not.toBe(200);
  });

  it('refuses a signed-in member', async () => {
    const member = await createTestSession(harness.db, 'Bob', 'user');
    const listed = await GET(listUsers({ authorization: member.bearer }));
    expect(listed.status).not.toBe(200);

    const created = await POST(createUser({ authorization: member.bearer }));
    expect(created.status).not.toBe(200);
    // The account it tried to write must not exist: an ordinary member cannot let somebody in.
    const rows = await harness.db.query.user.findMany();
    expect(rows.map((row) => row.email)).not.toContain('uninvited@example.com');
  });

  it('refuses a revoked admin', async () => {
    const admin = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    await revokeUser(harness.db, admin.userId, 'gone', new Date());
    expect((await GET(listUsers({ authorization: admin.bearer }))).status).not.toBe(200);
    expect((await POST(createUser({ authorization: admin.bearer }))).status).not.toBe(200);
  });
});
