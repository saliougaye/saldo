import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useDatabase } from '../db/DatabaseProvider';
import { type ApiClient, createApiClient } from '../net/apiClient';
import { createServerAuthClient, type ServerAuthClient } from './authClient';
import { checkServer, type ServerHealth, type SignedInUser, signIn, signOut } from './session';

export interface ServerValue {
  /** Null when the app is local-only (§6.29 step 0). */
  serverUrl: string | null;
  user: SignedInUser | null;
  api: ApiClient | null;
  sessionExpired: boolean;
  check(url: string): Promise<ServerHealth>;
  connect(url: string, mode: 'login' | 'register'): Promise<SignedInUser>;
  disconnect(): Promise<void>;
}

const ServerContext = createContext<ServerValue | null>(null);

/**
 * Owns the server connection: which server (in `kv`, so it survives restarts), whether there is a
 * session (Better Auth's, in SecureStore), and the API client the sync layer uses.
 */
export function ServerProvider({ children }: { children: ReactNode }) {
  const { kv } = useDatabase();
  const [serverUrl, setServerUrl] = useState<string | null>(() => kv.get('serverUrl'));
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const client = useMemo<ServerAuthClient | null>(
    () => (serverUrl === null ? null : createServerAuthClient(serverUrl)),
    [serverUrl],
  );

  const api = useMemo<ApiClient | null>(() => {
    if (serverUrl === null || client === null) return null;
    return createApiClient({
      serverUrl,
      // React Native does not send cookies by itself; the Expo client keeps them in SecureStore.
      getAuthHeaders: async () => {
        const cookie = await client.getCookie();
        return cookie === null || cookie.length === 0 ? null : { cookie };
      },
      onSessionExpired: () => {
        setSessionExpired(true);
        setUser(null);
      },
    });
  }, [serverUrl, client]);

  // A stored session has to be recognised on boot, not only after a sign-in.
  useEffect(() => {
    if (client === null) {
      setUser(null);
      return;
    }
    let cancelled = false;
    client
      .getSession()
      .then(({ data }) => {
        if (cancelled || data === null) return;
        setUser({ id: data.user.id, displayName: data.user.name });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client]);

  const connect = useCallback(
    async (url: string, mode: 'login' | 'register') => {
      const target = createServerAuthClient(url);
      const signedIn = await signIn({ serverUrl: url, client: target, mode });
      kv.set('serverUrl', url);
      setServerUrl(url);
      setUser(signedIn);
      setSessionExpired(false);
      return signedIn;
    },
    [kv],
  );

  const disconnect = useCallback(async () => {
    if (client !== null) await signOut(client);
    // §6.30 "Esci": the phone keeps its data and goes back to local-only.
    kv.remove('serverUrl');
    kv.remove('syncCursor');
    setServerUrl(null);
    setUser(null);
    setSessionExpired(false);
  }, [client, kv]);

  const value = useMemo<ServerValue>(
    () => ({
      serverUrl,
      user,
      api,
      sessionExpired,
      check: checkServer,
      connect,
      disconnect,
    }),
    [serverUrl, user, api, sessionExpired, connect, disconnect],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerValue {
  const value = useContext(ServerContext);
  if (value === null) throw new Error('useServer must be used inside a ServerProvider');
  return value;
}
