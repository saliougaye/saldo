import {
  type PullResponse,
  type PushResponse,
  SYNC_SCHEMA_VERSION,
  shouldApplyRemote,
} from '@saldo/core';
import { createTestContext, type TestContext } from '../db/testing';
import type { ApiClient } from '../net/apiClient';
import { runSyncCycle } from './client';
import { SYNCED_ENTITY_NAMES, SYNCED_TABLES } from './entities';
import { pendingCount } from './localStore';

interface ServerRow {
  entity: string;
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  data: unknown;
  seq: number;
}

interface PushBody {
  changes: {
    entity: string;
    id: string;
    updatedAt: string;
    deletedAt: string | null;
    data: unknown;
  }[];
}

/**
 * The server of §8.3 and §8.4, in memory: whole-row last-writer-wins on the HLC, a monotonic
 * `seq` per applied row, and pull paged by that seq. It stands in for `apps/web` so this test can
 * prove convergence deterministically instead of needing two simulators.
 */
function createMemoryServer() {
  const rows = new Map<string, ServerRow>();
  let seq = 0;
  const key = (entity: string, id: string) => `${entity}:${id}`;

  return {
    rows,
    push(body: PushBody): PushResponse {
      return {
        schemaVersion: SYNC_SCHEMA_VERSION,
        serverTime: '2026-09-10T10:00:00.000Z',
        results: body.changes.map((change) => {
          const stored = rows.get(key(change.entity, change.id));
          if (!shouldApplyRemote(change.updatedAt, stored?.updatedAt ?? null)) {
            return { entity: change.entity as 'tag', id: change.id, status: 'stale' as const };
          }
          seq += 1;
          rows.set(key(change.entity, change.id), {
            entity: change.entity,
            id: change.id,
            updatedAt: change.updatedAt,
            deletedAt: change.deletedAt,
            data: change.data,
            seq,
          });
          return { entity: change.entity as 'tag', id: change.id, status: 'applied' as const };
        }),
      };
    },
    pull(since: number, limit: number): PullResponse {
      const ordered = [...rows.values()]
        .filter((row) => row.seq > since)
        .sort((left, right) => left.seq - right.seq);
      const page = ordered.slice(0, limit);
      return {
        schemaVersion: SYNC_SCHEMA_VERSION,
        changes: page.map((row) => ({
          entity: row.entity as 'tag',
          id: row.id,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
          data: row.data,
          seq: row.seq,
        })),
        nextSince: page.at(-1)?.seq ?? since,
        hasMore: ordered.length > page.length,
      };
    },
  };
}

type MemoryServer = ReturnType<typeof createMemoryServer>;

function apiFor(server: MemoryServer): ApiClient {
  return {
    hasSession: async () => true,
    // Blobs have their own tests; these fakes only move rows.
    putBinary: async () => undefined,
    getBinary: async () => new Uint8Array(),
    post: async (_path, body, schema) => schema.parse(server.push(body as PushBody)),
    delete: async () => {
      throw new Error('not used by the cycle');
    },
    get: async (path, schema) => {
      const url = new URL(path, 'http://server.invalid');
      const since = Number.parseInt(url.searchParams.get('since') ?? '0', 10);
      const limit = Number.parseInt(url.searchParams.get('limit') ?? '500', 10);
      return schema.parse(server.pull(since, limit));
    },
  };
}

interface Device extends TestContext {
  name: string;
  sync(): Promise<void>;
}

function createDevice(name: string, server: MemoryServer): Device {
  const context = createTestContext();
  // Each device needs its own HLC identity, or two writes could compare equal.
  context.kv.set('deviceId', name);
  return {
    ...context,
    name,
    sync: async () => {
      await runSyncCycle({
        db: context.db,
        kv: context.kv,
        clock: context.clock,
        api: apiFor(server),
        deviceId: name,
      });
    },
  };
}

const account = (name: string) => ({
  name,
  type: 'checking' as const,
  institution: null,
  openingBalance: 1000,
  includeInSpendable: true,
  colorIndex: 0,
  icon: 'landmark',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
});

const categoryInput = (name: string) => ({
  name,
  direction: 'expense' as const,
  parentId: null,
  icon: 'cart',
  colorIndex: 1,
  archivedAt: null,
  sortOrder: 0,
});

/** Every synced row of a device, as `entity:id:updatedAt`, so two devices can be compared. */
function snapshot(device: Device): string[] {
  const lines: string[] = [];
  for (const entity of SYNCED_ENTITY_NAMES) {
    const table = SYNCED_TABLES[entity];
    const rows = device.db.select().from(table).all() as {
      id: string;
      updatedAt: string;
      deletedAt: string | null;
    }[];
    for (const row of rows) {
      lines.push(
        `${entity}:${row.id}:${row.updatedAt}:${row.deletedAt === null ? 'live' : 'gone'}`,
      );
    }
  }
  return lines.sort();
}

describe('two devices against one server', () => {
  it('converge after each creates rows offline', async () => {
    const server = createMemoryServer();
    const a = createDevice('device-a', server);
    const b = createDevice('device-b', server);

    const tag = a.repos.tags.create({ name: 'Rimborsabile' });
    a.repos.accounts.create(account('Conto A'));
    b.repos.tags.create({ name: 'Trasloco' });

    await a.sync();
    await b.sync();
    await a.sync();

    expect(snapshot(a)).toEqual(snapshot(b));
    expect(
      b.repos.tags
        .list()
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Rimborsabile', 'Trasloco']);
    expect(a.repos.tags.byId(tag.id)).not.toBeNull();
  });

  it('resolve a concurrent edit of the same row the same way on both', async () => {
    const server = createMemoryServer();
    const a = createDevice('device-a', server);
    const b = createDevice('device-b', server);

    const tag = a.repos.tags.create({ name: 'Original' });
    await a.sync();
    await b.sync();
    expect(b.repos.tags.byId(tag.id)?.name).toBe('Original');

    // Both edit the same row while offline; B writes second, so B's HLC is greater.
    a.repos.tags.rename(tag.id, 'From A');
    b.repos.tags.rename(tag.id, 'From B');

    await a.sync();
    await b.sync();
    await a.sync();

    expect(snapshot(a)).toEqual(snapshot(b));
    expect(a.repos.tags.byId(tag.id)?.name).toBe('From B');
    expect(b.repos.tags.byId(tag.id)?.name).toBe('From B');
  });

  it('let a later edit win over a delete, on both devices', async () => {
    const server = createMemoryServer();
    const a = createDevice('device-a', server);
    const b = createDevice('device-b', server);

    const tag = a.repos.tags.create({ name: 'Contested' });
    await a.sync();
    await b.sync();

    a.repos.tags.remove(tag.id);
    b.repos.tags.rename(tag.id, 'Still here');

    await a.sync();
    await b.sync();
    await a.sync();

    expect(snapshot(a)).toEqual(snapshot(b));
    // The rename came after the delete, so the row is alive with that name.
    expect(a.repos.tags.byId(tag.id)?.deletedAt).toBeNull();
    expect(a.repos.tags.byId(tag.id)?.name).toBe('Still here');
  });

  it('let a later delete win over an earlier edit, on both devices', async () => {
    const server = createMemoryServer();
    const a = createDevice('device-a', server);
    const b = createDevice('device-b', server);

    const tag = a.repos.tags.create({ name: 'Doomed' });
    await a.sync();
    await b.sync();

    a.repos.tags.rename(tag.id, 'Renamed');
    b.repos.tags.remove(tag.id);

    await a.sync();
    await b.sync();
    await a.sync();

    expect(snapshot(a)).toEqual(snapshot(b));
    expect(a.repos.tags.list().some((row) => row.id === tag.id)).toBe(false);
    expect(b.repos.tags.list().some((row) => row.id === tag.id)).toBe(false);
  });

  it('converge on transactions, the rows that actually carry money', async () => {
    const server = createMemoryServer();
    const a = createDevice('device-a', server);
    const b = createDevice('device-b', server);

    const created = a.repos.accounts.create(account('Conto'));
    const category = a.repos.categories.create(categoryInput('Spesa'));
    await a.sync();
    await b.sync();

    const transaction = a.repos.transactions.create({
      kind: 'expense',
      amount: 1234,
      date: '2026-09-10',
      accountId: created.id,
      toAccountId: null,
      categoryId: category.id,
      description: 'Esselunga',
      note: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: null,
    });
    await a.sync();
    await b.sync();

    expect(b.repos.transactions.byId(transaction.id)?.amount).toBe(1234);

    // B corrects the amount, A does not know yet.
    b.repos.transactions.update(transaction.id, { amount: 1300 });
    await b.sync();
    await a.sync();

    expect(a.repos.transactions.byId(transaction.id)?.amount).toBe(1300);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it('leave nothing pending once both have synced', async () => {
    const server = createMemoryServer();
    const a = createDevice('device-a', server);
    const b = createDevice('device-b', server);

    a.repos.tags.create({ name: 'One' });
    b.repos.tags.create({ name: 'Two' });
    await a.sync();
    await b.sync();
    await a.sync();

    expect(pendingCount(a.db)).toBe(0);
    expect(pendingCount(b.db)).toBe(0);
    // And the server holds one row per entity id, not duplicates.
    expect(server.rows.size).toBe(2);
  });
});
