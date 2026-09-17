import { createTestContext } from '../../db/testing';
import { SYNC_EPOCH_KEY } from '../../db/wipe';
import { type ApiClient, ApiClientError } from '../../net/apiClient';
import { createScheduler } from '../../sync/scheduler';
import { deleteAllData } from './deleteAllData';

function apiDeleting(answer: () => Promise<unknown>, paths: string[]): ApiClient {
  const unused = async (): Promise<never> => {
    throw new Error('not used');
  };
  return {
    hasSession: async () => true,
    get: unused,
    post: unused,
    putBinary: unused,
    getBinary: unused,
    delete: async (path, schema) => {
      paths.push(path);
      return schema.parse(await answer());
    },
  };
}

describe('deleteAllData', () => {
  it('deletes the server copy, then the files, then the rows', async () => {
    const context = createTestContext();
    context.repos.tags.create({ name: 'Trasloco' });
    const paths: string[] = [];
    let filesDeleted = 0;

    await deleteAllData({
      db: context.db,
      api: apiDeleting(async () => ({ epoch: 2 }), paths),
      scheduler: createScheduler({ deps: () => null }),
      deleteAttachmentFiles: () => {
        filesDeleted += 1;
      },
    });

    expect(paths).toEqual(['/api/data']);
    expect(filesDeleted).toBe(1);
    expect(context.repos.tags.list()).toEqual([]);
    expect(context.kv.get(SYNC_EPOCH_KEY)).toBe('2');
  });

  it('touches nothing on the phone when the server refuses', async () => {
    const context = createTestContext();
    context.repos.tags.create({ name: 'Trasloco' });
    context.kv.set(SYNC_EPOCH_KEY, '0');
    let filesDeleted = 0;

    await expect(
      deleteAllData({
        db: context.db,
        api: apiDeleting(async () => {
          throw new ApiClientError(401, 'session_expired', 'Sign in again');
        }, []),
        scheduler: createScheduler({ deps: () => null }),
        deleteAttachmentFiles: () => {
          filesDeleted += 1;
        },
      }),
    ).rejects.toMatchObject({ code: 'session_expired' });

    // Deleting the phone alone would be undone by the next sign-in: all or nothing.
    expect(context.repos.tags.list()).toHaveLength(1);
    expect(filesDeleted).toBe(0);
    expect(context.kv.get(SYNC_EPOCH_KEY)).toBe('0');
  });

  it('deletes the phone alone on a build with no server', async () => {
    const context = createTestContext();
    context.repos.tags.create({ name: 'Trasloco' });

    await deleteAllData({
      db: context.db,
      api: null,
      scheduler: null,
      deleteAttachmentFiles: () => undefined,
    });

    expect(context.repos.tags.list()).toEqual([]);
    expect(context.kv.get(SYNC_EPOCH_KEY)).toBeNull();
  });
});
