const KEY = 'saldo.lastPasskeyId';

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): Storage | null {
  // Server-rendered, or a browser that refuses storage in a private window: both mean "do not know".
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Decision 9: no table links a session to the credential that created it, so the ceremony that
 * signed **this browser** in says which one it used, here. Losing it costs one «in uso ora» label.
 */
export function rememberPasskey(credentialId: string, storage: Storage | null = browserStorage()) {
  try {
    storage?.setItem(KEY, credentialId);
  } catch {
    // A full or refused storage is not worth a failed sign-in.
  }
}

export function lastPasskeyId(storage: Storage | null = browserStorage()): string | null {
  try {
    return storage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}
