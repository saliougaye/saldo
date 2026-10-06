import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';
import { GET as pull } from '../sync/pull/route';
import { POST as push } from '../sync/push/route';
import { DELETE as deleteData, GET as readData } from './route';

let harness: TestDatabase;
let bearer: string;
const WALL = String(Date.now()).padStart(15, '0');

function tagChange(id: string) {
  const updatedAt = `${WALL}-0000-device-a`;
  return {
    entity: 'tag',
    id,
    updatedAt,
    deletedAt: null,
    data: { id, createdAt: '2026-09-17T09:00:00.000Z', updatedAt, deletedAt: null, name: id },
  };
}

function pushAs(auth: string, body: Record<string, unknown>): Promise<Response> {
  return push(
    new Request('http://localhost/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'device-a', ...body }),
      headers: { 'content-type': 'application/json', authorization: auth },
    }),
  );
}

function pullAs(auth: string, query: string): Promise<Response> {
  return pull(
    new Request(`http://localhost/api/sync/pull?${query}`, { headers: { authorization: auth } }),
  );
}

function dataRequest(method: 'GET' | 'DELETE', auth?: string): Request {
  return new Request('http://localhost/api/data', {
    method,
    headers: auth === undefined ? {} : { authorization: auth },
  });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  bearer = (await createTestSession(harness.db)).bearer;
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('/api/data', () => {
  it('deletes everything and answers the new epoch', async () => {
    await pushAs(bearer, { epoch: 0, changes: [tagChange('tag-1')] });

    const deleted = await deleteData(dataRequest('DELETE', bearer));
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ epoch: 1 });

    await expect((await readData(dataRequest('GET', bearer))).json()).resolves.toEqual({
      epoch: 1,
    });
    const page = await pullAs(bearer, 'since=0&epoch=1');
    await expect(page.json()).resolves.toMatchObject({ changes: [], hasMore: false });
  });

  it("leaves another account's data alone", async () => {
    const other = await createTestSession(harness.db, 'Bob');
    await pushAs(other.bearer, { epoch: 0, changes: [tagChange('tag-bob')] });

    await deleteData(dataRequest('DELETE', bearer));

    const page = await pullAs(other.bearer, 'since=0&epoch=0');
    const body = (await page.json()) as { changes: { id: string }[] };
    expect(body.changes.map((change) => change.id)).toEqual(['tag-bob']);
  });
});

describe('sync after a deletion', () => {
  it('refuses a push written against the previous generation, and writes nothing', async () => {
    await deleteData(dataRequest('DELETE', bearer));

    const refused = await pushAs(bearer, { epoch: 0, changes: [tagChange('tag-offline')] });
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: 'data_reset' } });

    const page = await pullAs(bearer, 'since=0&epoch=1');
    await expect(page.json()).resolves.toMatchObject({ changes: [] });
  });

  it('refuses a pull from the previous generation', async () => {
    await deleteData(dataRequest('DELETE', bearer));
    const refused = await pullAs(bearer, 'since=0&epoch=0');
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: 'data_reset' } });
  });

  it('accepts a push on the new generation, and one that names none', async () => {
    await deleteData(dataRequest('DELETE', bearer));
    expect((await pushAs(bearer, { epoch: 1, changes: [tagChange('tag-new')] })).status).toBe(200);
    expect((await pushAs(bearer, { changes: [tagChange('tag-unnamed')] })).status).toBe(200);
  });
});
