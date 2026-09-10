import { createKvStore } from './kv';
import { createTestDatabase } from './testing';

describe('createKvStore', () => {
  it('reads back what it writes and reports missing keys as null', () => {
    const store = createKvStore(createTestDatabase());
    expect(store.get('deviceId')).toBeNull();
    store.set('deviceId', 'abc123');
    expect(store.get('deviceId')).toBe('abc123');
  });

  it('overwrites an existing key instead of failing', () => {
    const store = createKvStore(createTestDatabase());
    store.set('serverUrl', 'https://a.example');
    store.set('serverUrl', 'https://b.example');
    expect(store.get('serverUrl')).toBe('https://b.example');
  });

  it('stores json values', () => {
    const store = createKvStore(createTestDatabase());
    store.setJson('hlc', { wallMs: 1000, counter: 2, deviceId: 'dev' });
    expect(store.getJson<{ counter: number }>('hlc')?.counter).toBe(2);
    expect(store.getJson('missing')).toBeNull();
  });

  it('creates a device id once and keeps it', () => {
    const store = createKvStore(createTestDatabase());
    const first = store.deviceId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.deviceId()).toBe(first);
  });

  it('removes keys', () => {
    const store = createKvStore(createTestDatabase());
    store.set('appLockEnabled', 'true');
    store.remove('appLockEnabled');
    expect(store.get('appLockEnabled')).toBeNull();
  });
});
