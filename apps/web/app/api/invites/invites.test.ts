import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_ROLE } from '../../../src/server/auth/admin';
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

  it('refuses anybody who is not the admin', async () => {
    expect((await POST(post({}))).status).toBe(401);
    expect((await POST(post({}, { authorization: 'Bearer nope' }))).status).toBe(401);
    const member = await createTestSession(harness.db, 'Bob', 'user');
    expect((await POST(post({}, { authorization: member.bearer }))).status).toBe(403);
  });
});

describe('GET /api/invites', () => {
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
});
