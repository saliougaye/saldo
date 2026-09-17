import { describe, expect, it } from 'vitest';
import {
  compareSchemaVersion,
  DATA_RESET_CODE,
  dataEpochResponseSchema,
  MAX_CHANGES_PER_PUSH,
  pullResponseSchema,
  pushRequestSchema,
  pushResponseSchema,
  SYNC_SCHEMA_VERSION,
  syncChangeSchema,
} from './protocol';

const change = {
  entity: 'transaction',
  id: '01920000-0000-7000-8000-000000000000',
  updatedAt: '001775000000000-0000-device-a',
  deletedAt: null,
  data: {
    id: '01920000-0000-7000-8000-000000000000',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '001775000000000-0000-device-a',
    deletedAt: null,
    kind: 'expense',
    amount: 1234,
    date: '2026-09-10',
    accountId: '01920000-0000-7000-8000-000000000001',
    toAccountId: null,
    categoryId: '01920000-0000-7000-8000-000000000002',
    description: 'Coffee',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  },
};

describe('syncChangeSchema', () => {
  it('accepts a change whose envelope matches its data', () => {
    expect(syncChangeSchema.safeParse(change).success).toBe(true);
  });

  it('rejects an envelope that disagrees with its data', () => {
    expect(syncChangeSchema.safeParse({ ...change, id: 'other' }).success).toBe(false);
    expect(
      syncChangeSchema.safeParse({ ...change, updatedAt: '001775000000001-0000-device-a' }).success,
    ).toBe(false);
    expect(
      syncChangeSchema.safeParse({ ...change, deletedAt: '2026-09-10T10:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('rejects an unknown entity name, a bad clock and an unparsable body', () => {
    expect(syncChangeSchema.safeParse({ ...change, entity: 'invoice' }).success).toBe(false);
    expect(syncChangeSchema.safeParse({ ...change, updatedAt: 'not-an-hlc' }).success).toBe(false);
    expect(
      syncChangeSchema.safeParse({ ...change, data: { ...change.data, kind: 'weekly' } }).success,
    ).toBe(false);
  });

  it('carries a tombstone on both the envelope and the data', () => {
    const deletedAt = '2026-09-10T11:00:00.000Z';
    expect(
      syncChangeSchema.safeParse({
        ...change,
        deletedAt,
        data: { ...change.data, deletedAt },
      }).success,
    ).toBe(true);
  });
});

describe('pushRequestSchema', () => {
  it('requires the schema version and caps the batch', () => {
    const body = { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'device-a', changes: [change] };
    expect(pushRequestSchema.safeParse(body).success).toBe(true);
    expect(pushRequestSchema.safeParse({ ...body, schemaVersion: undefined }).success).toBe(false);
    const tooMany = { ...body, changes: new Array(MAX_CHANGES_PER_PUSH + 1).fill(change) };
    expect(pushRequestSchema.safeParse(tooMany).success).toBe(false);
  });

  it('accepts an empty batch, which is how a client asks only to pull', () => {
    const body = { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'device-a', changes: [] };
    expect(pushRequestSchema.safeParse(body).success).toBe(true);
  });

  it('accepts a batch containing an unparsable body: that row is answered `invalid`', () => {
    const broken = { ...change, data: { nonsense: true } };
    const body = { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'device-a', changes: [broken] };
    expect(pushRequestSchema.safeParse(body).success).toBe(true);
    expect(syncChangeSchema.safeParse(broken).success).toBe(false);
  });
});

describe('responses', () => {
  it('parses a push response', () => {
    expect(
      pushResponseSchema.safeParse({
        schemaVersion: SYNC_SCHEMA_VERSION,
        serverTime: '2026-09-10T10:00:00.000Z',
        results: [
          { entity: 'transaction', id: change.id, status: 'applied' },
          { entity: 'transaction', id: change.id, status: 'stale' },
          { entity: 'transaction', id: change.id, status: 'invalid', error: 'amount: too small' },
        ],
      }).success,
    ).toBe(true);
  });

  it('parses a pull page and keeps its cursor', () => {
    const parsed = pullResponseSchema.safeParse({
      schemaVersion: SYNC_SCHEMA_VERSION,
      changes: [{ ...change, seq: 12 }],
      nextSince: 12,
      hasMore: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.nextSince).toBe(12);
  });
});

describe('compareSchemaVersion', () => {
  it('names which side is behind', () => {
    expect(compareSchemaVersion(SYNC_SCHEMA_VERSION)).toBe('ok');
    expect(compareSchemaVersion(SYNC_SCHEMA_VERSION - 1)).toBe('peer-too-old');
    expect(compareSchemaVersion(SYNC_SCHEMA_VERSION + 1)).toBe('peer-too-new');
  });
});

describe('data epoch', () => {
  it('lets a push name the generation it was written against, and accepts one that does not', () => {
    const base = { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'device-a', changes: [] };
    expect(pushRequestSchema.parse({ ...base, epoch: 3 }).epoch).toBe(3);
    expect(pushRequestSchema.parse(base).epoch).toBeUndefined();
    expect(pushRequestSchema.safeParse({ ...base, epoch: -1 }).success).toBe(false);
  });

  it('reads the epoch the server answers with', () => {
    expect(dataEpochResponseSchema.parse({ epoch: 0 })).toEqual({ epoch: 0 });
    expect(dataEpochResponseSchema.safeParse({ epoch: 1.5 }).success).toBe(false);
    expect(DATA_RESET_CODE).toBe('data_reset');
  });
});
