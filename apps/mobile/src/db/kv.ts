import { newId } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { kv } from './schema';
import type { TestDatabase } from './testing';

/**
 * Any Drizzle SQLite handle that can run the kv statements. Typed off the test driver so this
 * module stays importable in Node; the Expo handle is structurally compatible.
 */
export type KvDatabase = Pick<TestDatabase, 'select' | 'insert' | 'delete'>;

/** Device-local keys (§7). Never synced. */
export type KvKey = 'deviceId' | 'serverUrl' | 'syncCursor' | 'appLockEnabled' | 'hlc' | string;

export interface KvStore {
  get(key: KvKey): string | null;
  set(key: KvKey, value: string): void;
  remove(key: KvKey): void;
  getJson<T>(key: KvKey): T | null;
  setJson(key: KvKey, value: unknown): void;
  /** Stable per-install id, used as the HLC tiebreaker. */
  deviceId(): string;
}

export function createKvStore(db: KvDatabase): KvStore {
  const store: KvStore = {
    get(key) {
      const [row] = db.select().from(kv).where(eq(kv.key, key)).all();
      return row?.value ?? null;
    },
    set(key, value) {
      db.insert(kv)
        .values({ key, value })
        .onConflictDoUpdate({ target: kv.key, set: { value } })
        .run();
    },
    remove(key) {
      db.delete(kv).where(eq(kv.key, key)).run();
    },
    getJson<T>(key: KvKey): T | null {
      const raw = store.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    },
    setJson(key, value) {
      store.set(key, JSON.stringify(value));
    },
    deviceId() {
      const existing = store.get('deviceId');
      if (existing !== null) return existing;
      const created = newId();
      store.set('deviceId', created);
      return created;
    },
  };
  return store;
}
