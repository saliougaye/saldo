import type { z } from 'zod';
import { createRepositories, type Repositories } from '../db/repositories';
import { createTestDatabase } from '../db/testing';
import { type ApiClient, ApiClientError } from '../net/apiClient';
import { downloadBlob, uploadPendingBlobs } from './blobSync';

const CREATED_AT = '2026-04-18T10:00:00.000Z';
const BYTES = new Uint8Array([1, 2, 3, 4]);
const SHA = 'b'.repeat(64);

function setup(): Repositories {
  return createRepositories(createTestDatabase(), () => CREATED_AT);
}

function seed(repos: Repositories, id = 'att-1', localUri: string | null = 'file:///att-1.jpg') {
  return repos.attachments.create({
    id,
    transactionId: 'tx-1',
    mimeType: 'image/jpeg',
    byteSize: BYTES.byteLength,
    sha256: SHA,
    width: 10,
    height: 10,
    localUri,
  });
}

interface Recorder {
  posts: { path: string; body: unknown }[];
  puts: { path: string; bytes: Uint8Array; headers: Record<string, string> }[];
}

function fakeApi(
  recorder: Recorder,
  answers: {
    intent?: unknown;
    onPost?: (path: string) => void;
    binary?: Uint8Array;
  } = {},
): ApiClient {
  return {
    async get<T>(_path: string, _schema: z.ZodType<T>): Promise<T> {
      throw new Error('not used');
    },
    async post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
      recorder.posts.push({ path, body });
      answers.onPost?.(path);
      if (path.endsWith('/upload-intent')) {
        return schema.parse(answers.intent ?? { mode: 'direct' });
      }
      return schema.parse({});
    },
    async delete<T>(_path: string, _schema: z.ZodType<T>): Promise<T> {
      throw new Error('not used');
    },
    async putBinary(path: string, bytes: Uint8Array, headers: Record<string, string>) {
      recorder.puts.push({ path, bytes, headers });
    },
    async getBinary(): Promise<Uint8Array> {
      return answers.binary ?? BYTES;
    },
    async hasSession() {
      return true;
    },
  };
}

const deps = (repos: Repositories, api: ApiClient, overrides: Record<string, unknown> = {}) => ({
  repos,
  api,
  readBytes: () => BYTES,
  storeBytes: async (id: string) => ({ uri: `file:///stored/${id}.jpg`, sha256: SHA }),
  ...overrides,
});

describe('uploadPendingBlobs', () => {
  it('uploads through the server when the store has no URLs', async () => {
    const repos = setup();
    const row = seed(repos);
    const recorder: Recorder = { posts: [], puts: [] };
    const outcome = await uploadPendingBlobs(deps(repos, fakeApi(recorder)));

    expect(outcome).toMatchObject({ uploaded: 1, failed: 0 });
    expect(recorder.puts[0]?.path).toBe(`/api/attachments/${row.id}`);
    expect(recorder.puts[0]?.headers['x-content-sha256']).toBe(SHA);
    expect(repos.attachments.byId(row.id)?.blobState).toBe('synced');
  });

  it('uploads to the signed URL, then tells the server it arrived', async () => {
    const repos = setup();
    const row = seed(repos);
    const recorder: Recorder = { posts: [], puts: [] };
    const requests: Request[] = [];
    const outcome = await uploadPendingBlobs(
      deps(
        repos,
        fakeApi(recorder, {
          intent: {
            mode: 'presigned',
            url: 'https://bucket.example.com/signed',
            method: 'PUT',
            headers: { 'content-type': 'image/jpeg' },
            expiresIn: 300,
          },
        }),
        {
          fetchImpl: async (request: Request) => {
            requests.push(request);
            return new Response(null, { status: 200 });
          },
        },
      ),
    );

    expect(outcome.uploaded).toBe(1);
    expect(requests[0]?.url).toBe('https://bucket.example.com/signed');
    expect(recorder.puts).toEqual([]);
    expect(recorder.posts.map((entry) => entry.path)).toEqual([
      `/api/attachments/${row.id}/upload-intent`,
      `/api/attachments/${row.id}/complete`,
    ]);
  });

  it('marks a row failed when the store refuses the signed upload', async () => {
    const repos = setup();
    const row = seed(repos);
    const recorder: Recorder = { posts: [], puts: [] };
    const outcome = await uploadPendingBlobs(
      deps(
        repos,
        fakeApi(recorder, {
          intent: {
            mode: 'presigned',
            url: 'https://bucket.example.com/signed',
            method: 'PUT',
            headers: {},
            expiresIn: 300,
          },
        }),
        { fetchImpl: async () => new Response(null, { status: 403 }) },
      ),
    );
    expect(outcome).toMatchObject({ uploaded: 0, failed: 1 });
    expect(repos.attachments.byId(row.id)?.blobState).toBe('failed');
  });

  it('stops and marks nothing when the server keeps no attachments', async () => {
    const repos = setup();
    const first = seed(repos, 'att-1');
    seed(repos, 'att-2');
    const recorder: Recorder = { posts: [], puts: [] };
    const outcome = await uploadPendingBlobs(
      deps(
        repos,
        fakeApi(recorder, {
          onPost: () => {
            throw new ApiClientError(409, 'no_storage', 'no storage');
          },
        }),
      ),
    );
    expect(outcome).toMatchObject({ uploaded: 0, failed: 0, noStorage: true });
    // Left local, not failed: there is nothing wrong with these rows.
    expect(repos.attachments.byId(first.id)?.blobState).toBe('local_only');
    expect(recorder.posts).toHaveLength(1);
  });

  it('waits for the row to be pushed before trying again', async () => {
    const repos = setup();
    const row = seed(repos);
    const recorder: Recorder = { posts: [], puts: [] };
    const outcome = await uploadPendingBlobs(
      deps(
        repos,
        fakeApi(recorder, {
          onPost: () => {
            throw new ApiClientError(404, 'not_found', 'no such attachment');
          },
        }),
      ),
    );
    expect(outcome).toMatchObject({ uploaded: 0, failed: 0 });
    expect(repos.attachments.byId(row.id)?.blobState).toBe('local_only');
  });

  it('fails a row whose local file has gone missing', async () => {
    const repos = setup();
    const row = seed(repos);
    const recorder: Recorder = { posts: [], puts: [] };
    const outcome = await uploadPendingBlobs(
      deps(repos, fakeApi(recorder), { readBytes: () => null }),
    );
    expect(outcome).toMatchObject({ failed: 1 });
    expect(repos.attachments.byId(row.id)?.blobState).toBe('failed');
  });

  it('skips rows that are already on the server', async () => {
    const repos = setup();
    const row = seed(repos);
    repos.attachments.setBlobState(row.id, 'synced');
    const recorder: Recorder = { posts: [], puts: [] };
    expect(await uploadPendingBlobs(deps(repos, fakeApi(recorder)))).toMatchObject({ uploaded: 0 });
    expect(recorder.posts).toEqual([]);
  });
});

describe('downloadBlob', () => {
  it('stores the bytes and points the row at them', async () => {
    const repos = setup();
    const row = seed(repos, 'att-1', null);
    const recorder: Recorder = { posts: [], puts: [] };
    expect(await downloadBlob(deps(repos, fakeApi(recorder)), row.id)).toBe(true);
    expect(repos.attachments.byId(row.id)?.localUri).toBe('file:///stored/att-1.jpg');
  });

  it('does nothing when this device already has the file', async () => {
    const repos = setup();
    const row = seed(repos);
    const recorder: Recorder = { posts: [], puts: [] };
    expect(await downloadBlob(deps(repos, fakeApi(recorder)), row.id)).toBe(false);
  });

  it('refuses bytes whose hash is not the one the row records', async () => {
    const repos = setup();
    const row = seed(repos, 'att-1', null);
    const recorder: Recorder = { posts: [], puts: [] };
    await expect(
      downloadBlob(
        deps(repos, fakeApi(recorder), {
          storeBytes: async (id: string) => ({
            uri: `file:///stored/${id}.jpg`,
            sha256: 'c'.repeat(64),
          }),
        }),
        row.id,
      ),
    ).rejects.toThrow(ApiClientError);
    expect(repos.attachments.byId(row.id)?.localUri).toBeNull();
  });
});
