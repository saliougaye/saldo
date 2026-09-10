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
import { decideSession } from './sessionState';

export type ServerStatus = 'loading' | 'signed-out' | 'signed-in';

export interface ServerValue {
  /** Null until a server has been signed in to. */
  serverUrl: string | null;
  user: SignedInUser | null;
  api: ApiClient | null;
  /**
   * `loading` until the stored session has been read. Boot has to wait for it: redirecting on a
   * half-read session would send a signed-in user back to the sign-in screen.
   */
  status: ServerStatus;
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
  const [status, setStatus] = useState<ServerStatus>(
    kv.get('serverUrl') === null ? 'signed-out' : 'loading',
  );
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
      setStatus('signed-out');
      return;
    }
    let cancelled = false;
    void (async () => {
      // The cookie is on the device, so this answer needs no network: it is what lets a signed-in
      // user open the app offline. Only the server actually saying "no session" signs them out.
      const cookie = await client.getCookie().catch(() => null);
      if (cancelled) return;
      if (cookie === null || cookie.length === 0) {
        setUser(null);
        setStatus('signed-out');
        return;
      }
      setStatus('signed-in');
      const answer = await client
        .getSession()
        .then((result) => ({ kind: 'answered' as const, result }))
        .catch(() => ({ kind: 'unreachable' as const, result: null }));
      if (cancelled) return;
      const decision = decideSession(
        answer.kind === 'unreachable'
          ? { kind: 'unreachable' }
          : {
              kind: 'answered',
              hasSession: answer.result.data !== null,
              hasError: answer.result.error !== null,
            },
      );
      if (decision === 'signed-out') {
        setUser(null);
        setStatus('signed-out');
        return;
      }
      const data = answer.kind === 'answered' ? answer.result.data : null;
      if (decision === 'signed-in' && data !== null) {
        setUser({ id: data.user.id, displayName: data.user.name });
      }
    })();
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
      setStatus('signed-in');
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
    setStatus('signed-out');
    setSessionExpired(false);
  }, [client, kv]);

  const value = useMemo<ServerValue>(
    () => ({
      serverUrl,
      user,
      api,
      status,
      sessionExpired,
      check: checkServer,
      connect,
      disconnect,
    }),
    [serverUrl, user, api, status, sessionExpired, connect, disconnect],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerValue {
  const value = useContext(ServerContext);
  if (value === null) throw new Error('useServer must be used inside a ServerProvider');
  return value;
}
