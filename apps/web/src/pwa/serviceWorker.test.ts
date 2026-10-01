import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PRECACHE_URLS, serviceWorkerSource } from './serviceWorker';

type Handler = (event: FakeEvent) => void;

interface FakeEvent {
  request?: { mode: string; url: string };
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (response: Promise<unknown>) => void;
}

/** A just-enough worker global: caches keyed by name, `fetch` that can be switched off. */
function boot(version: string, existing: string[] = []) {
  const store = new Map<string, Map<string, string>>(existing.map((name) => [name, new Map()]));
  const handlers = new Map<string, Handler>();
  const fetched: string[] = [];
  const state = { online: true, skipped: false, claimed: false };

  class FakeRequest {
    constructor(
      readonly url: string,
      readonly init?: unknown,
    ) {}
  }
  const fakeCaches = {
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    open: async (name: string) => {
      let cache = store.get(name);
      if (cache === undefined) {
        cache = new Map();
        store.set(name, cache);
      }
      const entries = cache;
      return {
        addAll: async (requests: FakeRequest[]) => {
          for (const request of requests) entries.set(request.url, `cached:${request.url}`);
        },
        match: async (url: string) => entries.get(url),
      };
    },
  };
  const scope = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: async () => {
      state.skipped = true;
    },
    clients: {
      claim: async () => {
        state.claimed = true;
      },
    },
  };
  const context = {
    self: scope,
    caches: fakeCaches,
    Request: FakeRequest,
    Response: { error: () => 'network-error' },
    fetch: async (request: { url: string }) => {
      fetched.push(request.url);
      if (!state.online) throw new TypeError('offline');
      return `network:${request.url}`;
    },
  };
  vm.runInNewContext(serviceWorkerSource(version), context);

  /** Dispatches an event and returns whatever it handed to `waitUntil` / `respondWith`. */
  async function dispatch(type: string, request?: { mode: string; url: string }) {
    let result: Promise<unknown> | undefined;
    handlers.get(type)?.({
      request,
      waitUntil: (promise) => {
        result = promise;
      },
      respondWith: (promise) => {
        result = promise;
      },
    });
    return { handled: result !== undefined, value: await result };
  }
  return { store, state, fetched, dispatch };
}

describe('serviceWorkerSource', () => {
  it('precaches exactly the offline page and its icon on install, and takes over', async () => {
    const worker = boot('1');
    await worker.dispatch('install');
    expect([...(worker.store.get('saldo-offline-1')?.keys() ?? [])]).toEqual([...PRECACHE_URLS]);
    expect(worker.state.skipped).toBe(true);
  });

  it('passes a navigation through to the network and caches nothing new', async () => {
    const worker = boot('1');
    await worker.dispatch('install');
    const before = worker.store.get('saldo-offline-1')?.size;
    const result = await worker.dispatch('fetch', { mode: 'navigate', url: '/home' });
    expect(result.value).toBe('network:/home');
    expect(worker.store.get('saldo-offline-1')?.size).toBe(before);
  });

  it('answers a navigation with the offline page when the network is gone', async () => {
    const worker = boot('1');
    await worker.dispatch('install');
    worker.state.online = false;
    const result = await worker.dispatch('fetch', { mode: 'navigate', url: '/transactions' });
    expect(result.value).toBe('cached:/offline');
  });

  it('does not touch anything that is not a navigation', async () => {
    const worker = boot('1');
    await worker.dispatch('install');
    for (const url of ['/api/sync/pull', '/_next/static/app.js', '/home?_rsc=1']) {
      const result = await worker.dispatch('fetch', { mode: 'cors', url });
      expect(result.handled, url).toBe(false);
    }
    expect(worker.fetched).toEqual([]);
  });

  it('deletes older saldo caches on activate and keeps its own and foreign ones', async () => {
    const worker = boot('2', ['saldo-offline-1', 'saldo-offline-2', 'someone-else']);
    await worker.dispatch('activate');
    expect([...worker.store.keys()].sort()).toEqual(['saldo-offline-2', 'someone-else']);
    expect(worker.state.claimed).toBe(true);
  });
});
