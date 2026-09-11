import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_ROLE, revokeUser } from '../../../src/server/auth/admin';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';
import { DELETE } from './[id]/route';
import { GET, POST } from './route';

let harness: TestDatabase;

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/invites', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function get(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/invites', { headers });
}

function del(id: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost/api/invites/${id}`, { method: 'DELETE', headers });
}

interface CreatedInvite {
  code: string;
  invite: { id: string; label: string | null; status: string; expiresAt: string };
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('POST /api/invites', () => {
  it('mints a code for the admin and returns it once', async () => {
    const { bearer } = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    const response = await POST(post({ label: 'Marco', ttlDays: 3 }, { authorization: bearer }));
    expect(response.status).toBe(201);
    const body = (await response.json()) as CreatedInvite;
    expect(body.code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
    expect(body.invite.label).toBe('Marco');
    expect(body.invite.status).toBe('active');

    // The listing never carries it again: this response was the only copy.
    const listed = await GET(get({ authorization: bearer }));
    expect(JSON.stringify(await listed.json())).not.toContain(body.code.slice(0, 4));
  });

  it('defaults the label to nothing and the life to a week', async () => {
    const { bearer } = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    const response = await POST(post({}, { authorization: bearer }));
    expect(response.status).toBe(201);
    const body = (await response.json()) as CreatedInvite;
    expect(body.invite.label).toBeNull();
    const days = (new Date(body.invite.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('refuses a life outside the allowed range and a label nobody could read', async () => {
    const { bearer } = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    expect((await POST(post({ ttlDays: 0 }, { authorization: bearer }))).status).toBe(400);
    expect((await POST(post({ ttlDays: 400 }, { authorization: bearer }))).status).toBe(400);
    expect((await POST(post({ label: 'x'.repeat(200) }, { authorization: bearer }))).status).toBe(
      400,
    );
  });

  it('refuses anybody who is not the admin', async () => {
    expect((await POST(post({}))).status).toBe(401);
    expect((await POST(post({}, { authorization: 'Bearer nope' }))).status).toBe(401);
    const member = await createTestSession(harness.db, 'Bob', 'user');
    expect((await POST(post({}, { authorization: member.bearer }))).status).toBe(403);
  });

  it('refuses a revoked admin', async () => {
    const admin = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    await revokeUser(harness.db, admin.userId, 'gone', new Date());
    // The session rows are deleted by the revocation, so this is a 401 and not a 403: there is no
    // longer any session to judge.
    expect((await POST(post({}, { authorization: admin.bearer }))).status).toBe(401);
  });
});

describe('GET /api/invites', () => {
  it('lists what the owner minted, newest first, with a status each', async () => {
    const { bearer } = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    await POST(post({ label: 'one' }, { authorization: bearer }));
    await POST(post({ label: 'two' }, { authorization: bearer }));
    const response = await GET(get({ authorization: bearer }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { invites: { label: string; status: string }[] };
    expect(body.invites.map((invite) => invite.label)).toEqual(['two', 'one']);
    expect(body.invites.every((invite) => invite.status === 'active')).toBe(true);
  });

  it('refuses anybody who is not the admin', async () => {
    expect((await GET(get())).status).toBe(401);
    const member = await createTestSession(harness.db, 'Bob', 'user');
    expect((await GET(get({ authorization: member.bearer }))).status).toBe(403);
  });
});

describe('DELETE /api/invites/[id]', () => {
  it('revokes an invite, and says so only the first time', async () => {
    const { bearer } = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    const created = (await (
      await POST(post({}, { authorization: bearer }))
    ).json()) as CreatedInvite;
    const params = Promise.resolve({ id: created.invite.id });

    const response = await DELETE(del(created.invite.id, { authorization: bearer }), { params });
    expect(response.status).toBe(200);

    const again = await DELETE(del(created.invite.id, { authorization: bearer }), {
      params: Promise.resolve({ id: created.invite.id }),
    });
    expect(again.status).toBe(404);

    const listed = (await (await GET(get({ authorization: bearer }))).json()) as {
      invites: { status: string }[];
    };
    expect(listed.invites[0]?.status).toBe('revoked');
  });

  it('refuses anybody who is not the admin, and an unknown id', async () => {
    const member = await createTestSession(harness.db, 'Bob', 'user');
    const forbidden = await DELETE(del('whatever', { authorization: member.bearer }), {
      params: Promise.resolve({ id: 'whatever' }),
    });
    expect(forbidden.status).toBe(403);

    const { bearer } = await createTestSession(harness.db, 'Ada', ADMIN_ROLE);
    const missing = await DELETE(del('whatever', { authorization: bearer }), {
      params: Promise.resolve({ id: 'whatever' }),
    });
    expect(missing.status).toBe(404);
  });
});
