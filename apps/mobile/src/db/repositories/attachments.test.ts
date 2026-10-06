import { MAX_ATTACHMENTS_PER_TRANSACTION } from '@saldo/core';
import { createTestDatabase } from '../testing';
import { TooManyAttachmentsError } from './attachments';
import { createRepositories } from './index';

const CREATED_AT = '2026-04-18T10:00:00.000Z';

function setup() {
  const db = createTestDatabase();
  return { db, repos: createRepositories(db, () => CREATED_AT) };
}

const input = (overrides: Record<string, unknown> = {}) => ({
  transactionId: 'tx-1',
  mimeType: 'image/jpeg' as const,
  byteSize: 1024,
  sha256: 'a'.repeat(64),
  width: 800,
  height: 600,
  localUri: 'file:///attachments/att-1.jpg',
  ...overrides,
});

describe('attachments repository', () => {
  it('refuses the sixth attachment on a transaction', () => {
    const { repos } = setup();
    for (let index = 0; index < MAX_ATTACHMENTS_PER_TRANSACTION; index += 1) {
      repos.attachments.create(input({ id: `att-${index}` }));
    }
    expect(() => repos.attachments.create(input({ id: 'att-too-many' }))).toThrow(
      TooManyAttachmentsError,
    );
  });

  it('counts only live rows towards the cap', () => {
    const { repos } = setup();
    for (let index = 0; index < MAX_ATTACHMENTS_PER_TRANSACTION; index += 1) {
      repos.attachments.create(input({ id: `att-${index}` }));
    }
    repos.attachments.remove('att-0');
    expect(() => repos.attachments.create(input({ id: 'att-new' }))).not.toThrow();
  });

  it('changes no HLC when only the local path or the blob state moves', () => {
    const { repos } = setup();
    const created = repos.attachments.create(input());
    repos.attachments.setBlobState(created.id, 'synced');
    repos.attachments.setLocalUri(created.id, null);
    const after = repos.attachments.byId(created.id);
    expect(after?.updatedAt).toBe(created.updatedAt);
    expect(after?.blobState).toBe('synced');
    expect(after?.localUri).toBeNull();
  });

  it('queues only rows whose bytes are here and not yet on the server', () => {
    const { repos } = setup();
    const waiting = repos.attachments.create(input({ id: 'att-1' }));
    const done = repos.attachments.create(input({ id: 'att-2' }));
    repos.attachments.setBlobState(done.id, 'synced');
    const gone = repos.attachments.create(input({ id: 'att-3' }));
    repos.attachments.remove(gone.id);
    const withoutFile = repos.attachments.create(input({ id: 'att-4', localUri: null }));
    expect(withoutFile.localUri).toBeNull();

    expect(repos.attachments.pendingUploads(10).map((row) => row.id)).toEqual([waiting.id]);
  });
});
