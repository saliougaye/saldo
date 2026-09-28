import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { z } from 'zod';
import { deleteAllAttachmentFiles } from '../attachments/localFiles';
import { yieldSettingsToAccount } from '../db/adopt';
import { db } from '../db/client';
import { useDatabase } from '../db/DatabaseProvider';
import { hasLocalData, wipeDevice } from '../db/wipe';
import { log, shortId } from '../log';
import { type ApiClient, ApiClientError, createApiClient } from '../net/apiClient';
import { pendingCount } from '../sync/localStore';
import { createServerAuthClient, type ServerAuthClient } from './authClient';
import { DEVICE_ACCOUNT_KEY, ownershipVerdict } from './deviceOwner';
import { LAST_SERVER_URL_KEY, SERVER_URL_KEY } from './serverKeys';
import { checkServer, type ServerHealth, type SignedInUser, signIn, signOut } from './session';
import { decideSession } from './sessionState';

export type ServerStatus = 'loading' | 'signed-out' | 'signed-in';

export interface OwnershipQuestions {
  /** Rows of a **different** account are here: yes deletes them, no signs straight back out. */
  confirmForeignData?: (pending: number) => Promise<boolean>;
  /** Rows of **no** account are here (local-only): join the account, make way for it, or stop. */
  decideUnownedData?: () => Promise<'adopt' | 'discard' | 'cancel'>;
}

export interface ServerValue {
  /** The server this phone is signed in to (or whose session expired); null when local-only. */
  serverUrl: string | null;
  /** The last address that worked, to prefill the field after «Esci». */
  lastServerUrl: string | null;
  user: SignedInUser | null;
  api: ApiClient | null;
  /**
   * `loading` until the stored session has been read. Boot has to wait for it: redirecting on a
   * half-read session would send a signed-in user back to the sign-in screen.
   */
  status: ServerStatus;
  sessionExpired: boolean;
  check(url: string): Promise<ServerHealth>;
  /**
   * Both questions are asked before the session is installed — see `ownershipVerdict`. A missing
   * answer is a refusal: the account is signed back out and the phone is left as it was found.
   */
  connect(
    serverUrl: string,
    mode: 'login' | 'register',
    questions?: OwnershipQuestions,
  ): Promise<SignedInUser>;
  disconnect(): Promise<void>;
  /**
   * D32: gives this account a real address, over the synthetic one of §9.1. The server refuses to
   * replace an address that is already real (`email_already_set`), so this is only ever the first one.
   */
  saveEmail(email: string): Promise<void>;
}

const ServerContext = createContext<ServerValue | null>(null);

/**
 * Owns the server connection: which server (typed by the user and kept in `kv`, §6.30), whether
 * there is a session (Better Auth's, in SecureStore, scoped by server), and the API client the
 * sync layer uses. No address means local-only: no client, no API, no scheduler.
 */
export function ServerProvider({ children }: { children: ReactNode }) {
  const { kv } = useDatabase();
  const [serverUrl, setServerUrl] = useState<string | null>(() => kv.get(SERVER_URL_KEY));
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [status, setStatus] = useState<ServerStatus>(serverUrl === null ? 'signed-out' : 'loading');
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
        log('auth', 'no stored session on this device');
        setUser(null);
        setStatus('signed-out');
        return;
      }
      log('auth', 'stored session found, asking the server about it');
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
      log('auth', 'the server answered about the stored session', {
        answer: answer.kind,
        decision,
      });
      if (decision === 'signed-out') {
        setUser(null);
        setStatus('signed-out');
        return;
      }
      const data = answer.kind === 'answered' ? answer.result.data : null;
      if (decision === 'signed-in' && data !== null) {
        setUser({ id: data.user.id, displayName: data.user.name, email: data.user.email });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const connect = useCallback(
    async (url: string, mode: 'login' | 'register', questions: OwnershipQuestions = {}) => {
      const target = createServerAuthClient(url);
      log('auth', 'opening the ceremony', { mode });
      const signedIn = await signIn({ serverUrl: url, client: target, mode });
      log('auth', 'ceremony finished', { account: shortId(signedIn.id) });

      /**
       * Everything below happens **before** `setUser`, and that ordering is the point: nothing on
       * the phone records which account wrote a row, so `SyncProvider` starts a cycle the moment a
       * user appears and that cycle would push this device's pending rows into whichever account
       * has just signed in. The question has to be settled while there is still no session.
       */
      const stored = kv.get(DEVICE_ACCOUNT_KEY);
      const verdict = ownershipVerdict(stored, signedIn.id, hasLocalData(db));
      log('auth', 'whose data is on this phone', {
        stored: shortId(stored),
        incoming: shortId(signedIn.id),
        verdict,
      });

      /** Saying no must leave the phone exactly as it was found: the ceremony already succeeded. */
      const refuse = async (code: string, message: string): Promise<never> => {
        log('auth', 'refused, signing the new account back out', { code });
        await signOut(target);
        throw new ApiClientError(409, code, message);
      };
      const wipe = () => {
        log('auth', 'deleting the attachment files');
        deleteAllAttachmentFiles();
        log('auth', 'emptying the database');
        wipeDevice(db);
        log('auth', 'phone is clear');
      };

      if (verdict === 'foreign-data') {
        const pending = pendingCount(db);
        log('auth', 'asking before deleting another account data', { pending });
        const accepted = (await questions.confirmForeignData?.(pending)) ?? false;
        if (!accepted) await refuse('foreign_device_data', 'This phone holds another account data');
        wipe();
      }
      if (verdict === 'unowned-data') {
        log('auth', 'asking what to do with rows that belong to no account');
        const answer = (await questions.decideUnownedData?.()) ?? 'cancel';
        log('auth', 'unowned data', { answer });
        if (answer === 'cancel') await refuse('cancelled', 'Sign-in was cancelled');
        if (answer === 'discard') wipe();
        // «Porta nell'account»: the rows are pending and the first cycle pushes them — all but the
        // settings, which yield to the account's own if it has any.
        if (answer === 'adopt') yieldSettingsToAccount(db, kv.deviceId());
      }
      // After the wipe, never before: `wipeDevice` empties `kv` too.
      kv.set(DEVICE_ACCOUNT_KEY, signedIn.id);
      kv.set(SERVER_URL_KEY, url);
      kv.set(LAST_SERVER_URL_KEY, url);

      log('auth', 'installing the session, sync can start now');
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
    // §6.30 «Esci»: the phone keeps its data and carries on local-only. The address goes — it is
    // what makes a scheduler exist — and the next sign-in starts from an empty cursor, because
    // that account's rows may not be the ones it pulls next.
    kv.remove('syncCursor');
    kv.remove(SERVER_URL_KEY);
    setServerUrl(null);
    setUser(null);
    setStatus('signed-out');
    setSessionExpired(false);
  }, [client, kv]);

  const saveEmail = useCallback(
    async (email: string) => {
      if (api === null) throw new ApiClientError(401, 'no_session', 'Not signed in');
      const answer = await api.post('/api/me/email', { email }, z.object({ email: z.string() }));
      log('auth', 'the account has a real email now');
      setUser((current) => (current === null ? null : { ...current, email: answer.email }));
    },
    [api],
  );

  const value = useMemo<ServerValue>(
    () => ({
      serverUrl,
      lastServerUrl: kv.get(LAST_SERVER_URL_KEY),
      user,
      api,
      status,
      sessionExpired,
      check: checkServer,
      connect,
      disconnect,
      saveEmail,
    }),
    [serverUrl, user, api, status, sessionExpired, connect, disconnect, saveEmail, kv],
  );

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer(): ServerValue {
  const value = useContext(ServerContext);
  if (value === null) throw new Error('useServer must be used inside a ServerProvider');
  return value;
}
