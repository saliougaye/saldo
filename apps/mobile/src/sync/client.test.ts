import { type PullResponse, type PushResponse, SYNC_SCHEMA_VERSION } from '@saldo/core';
import { createTestContext } from '../db/testing';
import { DATA_RESET_NOTICE_KEY, SYNC_EPOCH_KEY } from '../db/wipe';
import { type ApiClient, ApiClientError } from '../net/apiClient';
import { runSyncCycle } from './client';
import { errorCount, pendingCount } from './localStore';

const EMPTY_PAGE: PullResponse = {
  schemaVersion: SYNC_SCHEMA_VERSION,
  changes: [],
  nextSince: 0,
  hasMore: false,
};

interface PushBody {
  epoch?: number;
  changes: { entity: string; id: string }[];
}

interface FakeServer {
  pushes: PushBody[];
  pushResponse: (body: PushBody) => PushResponse;
  pages: PullResponse[];
  /** The account's data generation; 0 unless a test deletes it. */
  epoch?: number;
  /** How many times the cycle asked `GET /api/data`. */
  epochReads?: number;
}

const refused = () => new ApiClientError(409, 'data_reset', 'deleted elsewhere');

function fakeApi(server: FakeServer): ApiClient {
  let pulls = 0;
  const current = () => server.epoch ?? 0;
  return {
    hasSession: async () => true,
    // Blobs have their own tests; these fakes only move rows.
    putBinary: async () => undefined,
    getBinary: async () => new Uint8Array(),
    post: async (_path, body, schema) => {
      const typed = body as PushBody;
      if (typed.epoch !== undefined && typed.epoch !== current()) throw refused();
      server.pushes.push(typed);
      return schema.parse(server.pushResponse(typed));
    },
    delete: async () => {
      throw new Error('not used by the cycle');
    },
    get: async (path, schema) => {
      const url = new URL(path, 'http://server.invalid');
      if (url.pathname === '/api/data') {
        server.epochReads = (server.epochReads ?? 0) + 1;
        return schema.parse({ epoch: current() });
      }
      const epoch = url.searchParams.get('epoch');
      if (epoch !== null && Number(epoch) !== current()) throw refused();
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

  it('runs afterPull once the pulled rows are in', async () => {
    const { db, kv, clock, repos } = createTestContext();
    const server: FakeServer = {
      pushes: [],
      pushResponse: appliedTo,
      pages: [{ ...EMPTY_PAGE, changes: [row('tag-remote', 1)], nextSince: 1 }],
    };
    let seen: string | undefined;
    await runSyncCycle({
      db,
      kv,
      clock,
      api: fakeApi(server),
      deviceId: 'device-a',
      afterPull: () => {
        seen = repos.tags.byId('tag-remote')?.name;
      },
    });
    expect(seen).toBe('tag-remote');
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

  it('learns the epoch once and sends it with every push and pull', async () => {
    const { db, kv, clock, repos } = createTestContext();
    repos.tags.create({ name: 'Rimborsabile' });
    const server: FakeServer = { pushes: [], pushResponse: appliedTo, pages: [], epoch: 3 };
    const deps = { db, kv, clock, api: fakeApi(server), deviceId: 'device-a' };

    await runSyncCycle(deps);
    repos.tags.create({ name: 'Trasloco' });
    await runSyncCycle(deps);

    expect(kv.get(SYNC_EPOCH_KEY)).toBe('3');
    expect(server.epochReads).toBe(1);
    expect(server.pushes.map((body) => body.epoch)).toEqual([3, 3]);
  });

  it('empties the phone and starts over when the data was deleted on another device', async () => {
    const { db, kv, clock, repos } = createTestContext();
    kv.set(SYNC_EPOCH_KEY, '0');
    kv.set('syncCursor', '40');
    // Written offline, against the generation that was deleted: it must not reach the server.
    repos.tags.create({ name: 'Scritto offline' });
    let filesDeleted = 0;
    const server: FakeServer = {
      pushes: [],
      pushResponse: appliedTo,
      epoch: 1,
      pages: [
        {
          schemaVersion: SYNC_SCHEMA_VERSION,
          changes: [row('tag-new', 1)],
          nextSince: 1,
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
      deleteAttachmentFiles: () => {
        filesDeleted += 1;
      },
    });

    expect(server.pushes).toEqual([]);
    expect(repos.tags.list().map((tag) => tag.id)).toEqual(['tag-new']);
    expect(outcome.pulled).toBe(1);
    expect(filesDeleted).toBe(1);
    expect(kv.get(SYNC_EPOCH_KEY)).toBe('1');
    expect(kv.get('syncCursor')).toBe('1');
    expect(kv.get(DATA_RESET_NOTICE_KEY)).toBe('true');
  });

  it('adopts the epoch without a notice when the phone held nothing to lose', async () => {
    // Signed out of one account and into another: the stored epoch is the other account's, and
    // there is no data on the phone that anybody deleted.
    const { db, kv, clock } = createTestContext();
    kv.set(SYNC_EPOCH_KEY, '5');
    const server: FakeServer = { pushes: [], pushResponse: appliedTo, pages: [], epoch: 0 };

    await runSyncCycle({ db, kv, clock, api: fakeApi(server), deviceId: 'device-a' });

    expect(kv.get(SYNC_EPOCH_KEY)).toBe('0');
    expect(kv.get(DATA_RESET_NOTICE_KEY)).toBeNull();
  });
});
