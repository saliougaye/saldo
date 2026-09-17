import { type PullResponse, type PushResponse, SYNC_SCHEMA_VERSION } from '@saldo/core';
import { createTestContext } from '../db/testing';
import type { ApiClient } from '../net/apiClient';
import { runSyncCycle } from './client';
import { errorCount, pendingCount } from './localStore';

interface PushBody {
  changes: { entity: string; id: string }[];
}

interface FakeServer {
  pushes: PushBody[];
  pushResponse: (body: PushBody) => PushResponse;
  pages: PullResponse[];
}

const EMPTY_PAGE: PullResponse = {
  schemaVersion: SYNC_SCHEMA_VERSION,
  changes: [],
  nextSince: 0,
  hasMore: false,
};

function fakeApi(server: FakeServer): ApiClient {
  let pulls = 0;
  return {
    hasSession: async () => true,
    // Blobs have their own tests; these fakes only move rows.
    putBinary: async () => undefined,
    getBinary: async () => new Uint8Array(),
    post: async (_path, body, schema) => {
      const typed = body as PushBody;
      server.pushes.push(typed);
      return schema.parse(server.pushResponse(typed));
    },
    delete: async () => {
      throw new Error('not used by the cycle');
    },
    get: async (_path, schema) => {
      const page = server.pages[pulls] ?? EMPTY_PAGE;
      pulls += 1;
      return schema.parse(page);
    },
  };
}

const appliedTo = (body: PushBody): PushResponse => ({
  schemaVersion: SYNC_SCHEMA_VERSION,
  serverTime: '2026-09-10T10:00:00.000Z',
  results: body.changes.map((change) => ({
    entity: change.entity as 'tag',
    id: change.id,
    status: 'applied' as const,
  })),
});

const row = (id: string, seq: number) => {
  const updatedAt = `99999999999999${seq}-0000-device-b`;
  return {
    entity: 'tag' as const,
    id,
    updatedAt,
    deletedAt: null,
    seq,
    data: {
      id,
      createdAt: '2026-09-10T09:00:00.000Z',
      updatedAt,
      deletedAt: null,
      name: id,
    },
  };
};

describe('runSyncCycle', () => {
  it('pushes pending rows and clears their flag', async () => {
    const { db, kv, clock, repos } = createTestContext();
    repos.tags.create({ name: 'Rimborsabile' });
    const server: FakeServer = { pushes: [], pushResponse: appliedTo, pages: [] };

    const outcome = await runSyncCycle({
      db,
      kv,
      clock,
      api: fakeApi(server),
      deviceId: 'device-a',
    });
    expect(outcome.pushed).toBeGreaterThan(0);
    expect(pendingCount(db)).toBe(0);
    expect(server.pushes).toHaveLength(1);
  });

  it('treats stale as acknowledged and invalid as an error state', async () => {
    const { db, kv, clock, repos } = createTestContext();
    const stale = repos.tags.create({ name: 'Stale' });
    const invalid = repos.tags.create({ name: 'Invalid' });
    const server: FakeServer = {
      pushes: [],
      pushResponse: (body) => ({
        schemaVersion: SYNC_SCHEMA_VERSION,
        serverTime: '2026-09-10T10:00:00.000Z',
        results: body.changes.map((change) => ({
          entity: change.entity as 'tag',
          id: change.id,
          status: change.id === invalid.id ? ('invalid' as const) : ('stale' as const),
          ...(change.id === invalid.id ? { error: 'name: too short' } : {}),
        })),
      }),
      pages: [],
    };

    const outcome = await runSyncCycle({
      db,
      kv,
      clock,
      api: fakeApi(server),
      deviceId: 'device-a',
    });
    expect(outcome).toMatchObject({ stale: 1, invalid: 1, pushed: 0 });
    expect(pendingCount(db)).toBe(0);
    expect(errorCount(db)).toBe(1);
    expect(stale.id).not.toBe(invalid.id);
  });

  it('follows every pull page and keeps the last cursor', async () => {
    const { db, kv, clock } = createTestContext();
    const server: FakeServer = {
      pushes: [],
      pushResponse: appliedTo,
      pages: [
        {
          schemaVersion: SYNC_SCHEMA_VERSION,
          changes: [row('tag-1', 1)],
          nextSince: 1,
          hasMore: true,
        },
        {
          schemaVersion: SYNC_SCHEMA_VERSION,
          changes: [row('tag-2', 2)],
          nextSince: 2,
          hasMore: false,
        },
      ],
    };

    const outcome = await runSyncCycle({
      db,
      kv,
      clock,
      api: fakeApi(server),
      deviceId: 'device-a',
    });
    expect(outcome.pulled).toBe(2);
    expect(kv.get('syncCursor')).toBe('2');
  });

  it('stops instead of looping when the server keeps its cursor still', async () => {
    const { db, kv, clock } = createTestContext();
    const stuck: PullResponse = {
      schemaVersion: SYNC_SCHEMA_VERSION,
      changes: [row('tag-1', 0)],
      nextSince: 0,
      hasMore: true,
    };
    const server: FakeServer = {
      pushes: [],
      pushResponse: appliedTo,
      // Every page claims there is more but never advances; the cycle must not spin.
      pages: [stuck, stuck, stuck, stuck],
    };
    const outcome = await runSyncCycle({
      db,
      kv,
      clock,
      api: fakeApi(server),
      deviceId: 'device-a',
    });
    expect(outcome.pulled).toBe(1);
  });

  it('runs the materialiser after a cycle', async () => {
    const { db, kv, clock } = createTestContext();
    let ran = 0;
    await runSyncCycle({
      db,
      kv,
      clock,
      api: fakeApi({ pushes: [], pushResponse: appliedTo, pages: [] }),
      deviceId: 'device-a',
      materialise: () => {
        ran += 1;
      },
    });
    expect(ran).toBe(1);
  });

  it('refuses to sync with a peer on another schema version', async () => {
    const { db, kv, clock } = createTestContext();
    const server: FakeServer = {
      pushes: [],
      pushResponse: appliedTo,
      pages: [{ ...EMPTY_PAGE, schemaVersion: SYNC_SCHEMA_VERSION + 1 }],
    };
    await expect(
      runSyncCycle({ db, kv, clock, api: fakeApi(server), deviceId: 'device-a' }),
    ).rejects.toMatchObject({ code: 'schema_too_new' });
  });
});
