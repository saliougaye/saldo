import type { PullChange } from '@saldo/core';
import { createTestContext } from '../db/testing';
import {
  applyPull,
  errorCount,
  markInvalid,
  markPushed,
  pendingChanges,
  pendingCount,
} from './localStore';

describe('pendingChanges', () => {
  it('returns every locally written row as a change envelope', () => {
    const { db, repos } = createTestContext();
    const tag = repos.tags.create({ name: 'Rimborsabile' });
    const found = pendingChanges(db, 500).find((change) => change.id === tag.id);
    expect(found).toMatchObject({ entity: 'tag', id: tag.id, updatedAt: tag.updatedAt });
    expect(found?.data).toMatchObject({ name: 'Rimborsabile' });
    // The device-only column never goes on the wire.
    expect(found?.data).not.toHaveProperty('syncState');
  });

  it('includes tombstones, which the repositories hide', () => {
    const { db, repos } = createTestContext();
    const tag = repos.tags.create({ name: 'Gone' });
    repos.tags.remove(tag.id);
    const change = pendingChanges(db, 500).find((candidate) => candidate.id === tag.id);
    expect(change?.deletedAt).not.toBeNull();
    // `list` hides a tombstoned row; `byId` still reads it, which is how the row can be restored.
    expect(repos.tags.list().some((row) => row.id === tag.id)).toBe(false);
  });

  it('respects the batch limit', () => {
    const { db, repos } = createTestContext();
    for (let i = 0; i < 5; i += 1) repos.tags.create({ name: `tag-${i}` });
    expect(pendingChanges(db, 3)).toHaveLength(3);
  });

  it('stops returning a row once it is marked pushed', () => {
    const { db, repos } = createTestContext();
    const tag = repos.tags.create({ name: 'Rimborsabile' });
    const before = pendingCount(db);
    markPushed(db, 'tag', tag.id, tag.updatedAt);
    expect(pendingCount(db)).toBe(before - 1);
    expect(pendingChanges(db, 500).some((change) => change.id === tag.id)).toBe(false);
  });

  it('keeps a row pending when it was written again during the push', () => {
    const { db, repos } = createTestContext();
    const tag = repos.tags.create({ name: 'First' });
    const pushedClock = tag.updatedAt;
    repos.tags.rename(tag.id, 'Second');
    // §8.3: only clear the flag if the row still carries the timestamp that was pushed.
    markPushed(db, 'tag', tag.id, pushedClock);
    expect(pendingChanges(db, 500).some((change) => change.id === tag.id)).toBe(true);
  });

  it('marks a rejected row as an error and stops pushing it', () => {
    const { db, repos } = createTestContext();
    const tag = repos.tags.create({ name: 'Rejected' });
    markInvalid(db, 'tag', tag.id);
    expect(pendingChanges(db, 500).some((change) => change.id === tag.id)).toBe(false);
    expect(errorCount(db)).toBe(1);
    // Editing it again queues another attempt.
    repos.tags.rename(tag.id, 'Fixed');
    expect(pendingChanges(db, 500).some((change) => change.id === tag.id)).toBe(true);
    expect(errorCount(db)).toBe(0);
  });
});

function pulled(overrides: { id: string; seq: number } & Partial<PullChange>): PullChange {
  const updatedAt = overrides.updatedAt ?? '001775000000000-0000-device-b';
  return {
    entity: 'tag',
    deletedAt: null,
    ...overrides,
    updatedAt,
    data: {
      id: overrides.id,
      createdAt: '2026-09-10T09:00:00.000Z',
      updatedAt,
      deletedAt: overrides.deletedAt ?? null,
      // Short on purpose: a tag name is capped at 40 characters, and an over-long fixture would
      // be counted as a rejected row rather than an applied one.
      name: 'remote',
    },
  };
}

describe('applyPull', () => {
  it('inserts a remote row as synced and advances the cursor', () => {
    const { db, kv, clock } = createTestContext();
    const outcome = applyPull({
      db,
      kv,
      clock,
      changes: [pulled({ id: 'tag-1', seq: 7 })],
      nextSince: 7,
    });
    expect(outcome).toMatchObject({ applied: 1, skipped: 0, errors: 0 });
    expect(kv.get('syncCursor')).toBe('7');
    // Synced, so the scheduler will not push it straight back.
    expect(pendingCount(db)).toBe(0);
  });

  it('overwrites an older local row and keeps a newer one', () => {
    const { db, kv, clock, repos } = createTestContext();
    const tag = repos.tags.create({ name: 'local' });
    const older = pulled({ id: tag.id, seq: 1, updatedAt: '001775000000000-0000-device-b' });
    const newer = pulled({ id: tag.id, seq: 2, updatedAt: '999999999999999-0000-device-b' });

    expect(applyPull({ db, kv, clock, changes: [older], nextSince: 1 })).toMatchObject({
      applied: 0,
      skipped: 1,
    });
    expect(repos.tags.byId(tag.id)?.name).toBe('local');

    expect(applyPull({ db, kv, clock, changes: [newer], nextSince: 2 })).toMatchObject({
      applied: 1,
    });
    expect(repos.tags.byId(tag.id)?.name).toBe('remote');
  });

  it('applies a tombstone', () => {
    const { db, kv, clock, repos } = createTestContext();
    const tag = repos.tags.create({ name: 'local' });
    applyPull({
      db,
      kv,
      clock,
      changes: [
        pulled({
          id: tag.id,
          seq: 1,
          updatedAt: '999999999999999-0000-device-b',
          deletedAt: '2026-09-10T10:00:00.000Z',
        }),
      ],
      nextSince: 1,
    });
    expect(repos.tags.list().some((row) => row.id === tag.id)).toBe(false);
    expect(repos.tags.byId(tag.id)?.deletedAt).not.toBeNull();
  });

  it('counts an unparsable row as an error and still advances the cursor', () => {
    const { db, kv, clock } = createTestContext();
    const broken = { ...pulled({ id: 'tag-1', seq: 3 }), data: { nonsense: true } };
    const outcome = applyPull({ db, kv, clock, changes: [broken], nextSince: 3 });
    // One bad row must not wedge sync forever, so the cursor moves past it (§8.1).
    expect(outcome).toMatchObject({ applied: 0, errors: 1 });
    expect(kv.get('syncCursor')).toBe('3');
  });

  it('advances the local clock past every timestamp it saw', () => {
    const { db, kv, clock } = createTestContext();
    applyPull({
      db,
      kv,
      clock,
      changes: [pulled({ id: 'tag-1', seq: 1, updatedAt: '999999999999999-0000-device-b' })],
      nextSince: 1,
    });
    // The next local write must sort after the remote one, or the remote row would keep winning.
    expect(clock.now() > '999999999999999-0000-device-b').toBe(true);
  });

  it('never puts a device-local column of an attachment on the wire', () => {
    const { db, repos } = createTestContext();
    repos.attachments.create({
      transactionId: 'tx-1',
      mimeType: 'image/jpeg',
      byteSize: 1024,
      sha256: 'a'.repeat(64),
      width: 100,
      height: 100,
      localUri: 'file:///attachments/att-1.jpg',
    });
    const change = pendingChanges(db, 50).find((entry) => entry.entity === 'attachment');
    expect(change).toBeDefined();
    // `localUri` is a path inside this installation's sandbox and `blobState` is this device's
    // own upload progress; neither means anything to another device (§10).
    expect(change?.data).not.toHaveProperty('localUri');
    expect(change?.data).not.toHaveProperty('blobState');
    expect(change?.data).toMatchObject({ sha256: 'a'.repeat(64), byteSize: 1024 });
  });

  it('ignores an entity this version does not know', () => {
    const { db, kv, clock } = createTestContext();
    // A server one version ahead may send something this app has never heard of; skipping it and
    // still moving the cursor is what keeps the pull from stalling forever on that row.
    const unknown = {
      ...pulled({ id: 'thing-1', seq: 4 }),
      entity: 'invention' as unknown as 'tag',
    };
    expect(applyPull({ db, kv, clock, changes: [unknown], nextSince: 4 })).toMatchObject({
      skipped: 1,
    });
    expect(kv.get('syncCursor')).toBe('4');
  });
});
