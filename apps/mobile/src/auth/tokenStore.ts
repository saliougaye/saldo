import * as SecureStore from 'expo-secure-store';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms, computed from `expires_in` when the pair is issued. */
  expiresAt: number;
  userId: string;
  displayName: string;
}

export interface TokenStore {
  load(serverUrl: string): Promise<Tokens | null>;
  save(serverUrl: string, tokens: Tokens): Promise<void>;
  clear(serverUrl: string): Promise<void>;
}

/**
 * §9.3 step 8: keys are scoped by server URL, so pointing the app at a second server does not
 * overwrite the first one's session. SecureStore only accepts alphanumerics, `.`, `-` and `_`,
 * hence the sanitising.
 */
export function tokenKey(serverUrl: string): string {
  return `saldo_tokens_${serverUrl.replace(/[^A-Za-z0-9.\-_]/g, '_')}`;
}

export function createSecureTokenStore(): TokenStore {
  return {
    async load(serverUrl) {
      const raw = await SecureStore.getItemAsync(tokenKey(serverUrl));
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as Tokens;
      } catch {
        // A corrupt entry reads as signed out rather than crashing the app on boot.
        return null;
      }
    },
    async save(serverUrl, tokens) {
      await SecureStore.setItemAsync(tokenKey(serverUrl), JSON.stringify(tokens));
    },
    async clear(serverUrl) {
      await SecureStore.deleteItemAsync(tokenKey(serverUrl));
    },
  };
}

/** In-memory store for tests. */
export function createMemoryTokenStore(): TokenStore {
  const map = new Map<string, Tokens>();
  return {
    load: async (serverUrl) => map.get(serverUrl) ?? null,
    save: async (serverUrl, tokens) => {
      map.set(serverUrl, tokens);
    },
    clear: async (serverUrl) => {
      map.delete(serverUrl);
    },
  };
}
