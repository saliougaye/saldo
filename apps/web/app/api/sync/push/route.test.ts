import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { issueAccessToken } from '../../../../src/server/auth/tokens';
import { users } from '../../../../src/server/db/schema';
import { createTestDatabase, type TestDatabase } from '../../../../src/server/test/harness';
import { GET as pull } from '../pull/route';
import { POST as push } from './route';

let harness: TestDatabase;
let bearer: string;
let userId: string;
const WALL = String(Date.now()).padStart(15, '0');

function tagChange(id: string, name: string) {
  const updatedAt = `${WALL}-0000-device-a`;
  return {
    entity: 'tag',
    id,
    updatedAt,
    deletedAt: null,
    data: { id, createdAt: '2026-09-10T09:00:00.000Z', updatedAt, deletedAt: null, name },
  };
}

function pushRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/sync/push', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
  });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  const [user] = await harness.db.insert(users).values({ displayName: 'Ada' }).returning();
  if (user === undefined) throw new Error('insert returned no row');
  userId = user.id;
  bearer = `Bearer ${await issueAccessToken(user.id, new Date())}`;
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('sync routes', () => {
  it('requires a bearer on both', async () => {
    expect((await push(pushRequest({}))).status).toBe(401);
    expect((await pull(new Request('http://localhost/api/sync/pull'))).status).toBe(401);
  });

  it('round-trips a row from push to pull', async () => {
    const pushed = await push(
      pushRequest(
        {
          schemaVersion: SYNC_SCHEMA_VERSION,
          deviceId: 'device-a',
          changes: [tagChange('tag-1', 'Rimborsabile')],
        },
        { authorization: bearer },
      ),
    );
    expect(pushed.status).toBe(200);
    await expect(pushed.json()).resolves.toMatchObject({
      schemaVersion: SYNC_SCHEMA_VERSION,
      results: [{ id: 'tag-1', status: 'applied' }],
    });

    const page = await pull(
      new Request('http://localhost/api/sync/pull?since=0', {
        headers: { authorization: bearer },
      }),
    );
    const body = (await page.json()) as { changes: { id: string }[]; nextSince: number };
    expect(body.changes.map((change) => change.id)).toEqual(['tag-1']);

    const after = await pull(
      new Request(`http://localhost/api/sync/pull?since=${body.nextSince}`, {
        headers: { authorization: bearer },
      }),
    );
    await expect(after.json()).resolves.toMatchObject({ changes: [], hasMore: false });
  });

  it('refuses a peer on a different schema version', async () => {
    // A version below 1 is not a representable version, so "the app is older than this server"
    // only becomes reachable once SYNC_SCHEMA_VERSION is bumped; the branch itself is covered by
    // compareSchemaVersion's unit tests in @saldo/core.
    if (SYNC_SCHEMA_VERSION > 1) {
      const older = await push(
        pushRequest(
          { schemaVersion: SYNC_SCHEMA_VERSION - 1, deviceId: 'device-a', changes: [] },
          { authorization: bearer },
        ),
      );
      expect(older.status).toBe(409);
      await expect(older.json()).resolves.toMatchObject({ error: { code: 'schema_too_old' } });
    }

    const newer = await push(
      pushRequest(
        { schemaVersion: SYNC_SCHEMA_VERSION + 1, deviceId: 'device-a', changes: [] },
        { authorization: bearer },
      ),
    );
    expect(newer.status).toBe(409);
    await expect(newer.json()).resolves.toMatchObject({ error: { code: 'schema_too_new' } });
  });

  it('scopes the pull to the bearer', async () => {
    await push(
      pushRequest(
        {
          schemaVersion: SYNC_SCHEMA_VERSION,
          deviceId: 'device-a',
          changes: [tagChange('tag-1', 'Ada')],
        },
        { authorization: bearer },
      ),
    );
    const [other] = await harness.db.insert(users).values({ displayName: 'Bob' }).returning();
    if (other === undefined) throw new Error('insert returned no row');
    const otherBearer = `Bearer ${await issueAccessToken(other.id, new Date())}`;
    const page = await pull(
      new Request('http://localhost/api/sync/pull?since=0', {
        headers: { authorization: otherBearer },
      }),
    );
    await expect(page.json()).resolves.toMatchObject({ changes: [] });
    expect(userId).not.toBe(other.id);
  });
});
