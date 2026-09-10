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
import { type ApiClient, ApiClientError, createApiClient } from '../net/apiClient';
import { createServerAuthClient, type ServerAuthClient } from './authClient';
import { BUILD_SERVER_URL } from './buildServer';
import { checkServer, type ServerHealth, type SignedInUser, signIn, signOut } from './session';
import { decideSession } from './sessionState';

export type ServerStatus = 'loading' | 'signed-out' | 'signed-in';

export interface ServerValue {
  /** The server this build points at (§15); null only when it was built without one. */
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
  connect(mode: 'login' | 'register'): Promise<SignedInUser>;
  disconnect(): Promise<void>;
}

const ServerContext = createContext<ServerValue | null>(null);

/**
 * Owns the server connection: whether there is a session (Better Auth's, in SecureStore) and the
 * API client the sync layer uses. *Which* server is not state at all — the build decides it
 * (§15), so there is nothing to store, nothing to forget on sign-out, and nothing to migrate when
 * a later build points somewhere else.
 */
export function ServerProvider({ children }: { children: ReactNode }) {
  const { kv } = useDatabase();
  // Fixed for the life of the process, so it appears in no dependency list below.
  const serverUrl = BUILD_SERVER_URL;
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [status, setStatus] = useState<ServerStatus>(serverUrl === null ? 'signed-out' : 'loading');
  const [sessionExpired, setSessionExpired] = useState(false);

  const client = useMemo<ServerAuthClient | null>(
    () => (serverUrl === null ? null : createServerAuthClient(serverUrl)),
    [],
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
  }, [client]);

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

  const connect = useCallback(async (mode: 'login' | 'register') => {
    // Unreachable from the UI, which hides the buttons; a thrown error beats a silent no-op.
    if (serverUrl === null) throw new ApiClientError(500, 'no_server', 'No server configured');
    const target = createServerAuthClient(serverUrl);
    const signedIn = await signIn({ serverUrl, client: target, mode });
    setUser(signedIn);
    setStatus('signed-in');
    setSessionExpired(false);
    return signedIn;
  }, []);

  const disconnect = useCallback(async () => {
    if (client !== null) await signOut(client);
    // §6.30 "Esci": the phone keeps its data, and the next sign-in starts from an empty cursor
    // because this account's rows may not be the ones it pulls next.
    kv.remove('syncCursor');
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
    [user, api, status, sessionExpired, connect, disconnect],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerValue {
  const value = useContext(ServerContext);
  if (value === null) throw new Error('useServer must be used inside a ServerProvider');
  return value;
}
