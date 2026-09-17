import type { z } from 'zod';
import { log, ms } from '../log';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClient {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
  delete<T>(path: string, schema: z.ZodType<T>): Promise<T>;
  /** Raw bytes up, with no JSON in either direction: attachment blobs (§10). */
  putBinary(path: string, bytes: Uint8Array, headers: Record<string, string>): Promise<void>;
  /** Raw bytes down. Follows the redirect a presigning store answers with. */
  getBinary(path: string): Promise<Uint8Array>;
  /** Whether a session is stored for this server. */
  hasSession(): Promise<boolean>;
}

export interface ApiClientOptions {
  serverUrl: string;
  /**
   * The headers that carry Better Auth's session, or null when this device is signed out. On React
   * Native that is the `Cookie` header the Expo client keeps in SecureStore — cookies are not sent
   * automatically there, so they are attached by hand (as Better Auth's Expo guide prescribes).
   */
  getAuthHeaders: () => Promise<Record<string, string> | null>;
  onSessionExpired?: () => void;
  fetchImpl?: (request: Request) => Promise<Response>;
}

async function readError(response: Response): Promise<ApiClientError> {
  const payload: unknown = await response.json().catch(() => null);
  const error =
    typeof payload === 'object' && payload !== null
      ? (payload as { error?: { code?: string; message?: string } }).error
      : undefined;
  return new ApiClientError(
    response.status,
    error?.code ?? 'http_error',
    error?.message ?? `Request failed with ${response.status}`,
  );
}

/**
 * The one place that talks to the server. It attaches the bearer Better Auth issued and reports a
 * 401 as an expired session.
 *
 * There is no refresh dance here on purpose: Better Auth renews a session as it is used, so there
 * is no second credential to rotate — and no reuse-detection race to lose.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? ((request: Request) => fetch(request));
  const base = options.serverUrl.replace(/\/$/, '');

  const send = async <T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> => {
    const method = init.method ?? 'GET';
    const startedAt = Date.now();
    const auth = await options.getAuthHeaders();
    if (auth === null) {
      log('net', `${method} ${path} not sent: no session on this device`);
      throw new ApiClientError(401, 'no_session', 'Not signed in');
    }
    const response = await fetchImpl(
      new Request(`${base}${path}`, {
        ...init,
        // `omit` so the platform does not also attach its own cookie jar and confuse the server.
        credentials: 'omit',
        headers: { ...(init.headers as Record<string, string> | undefined), ...auth },
      }),
    ).catch((error: unknown) => {
      // The one failure that carries no status: wrong address, no DNS, nothing listening. Upstream
      // it turns into `network_error`, which does not say which of those it was.
      log('net', `${method} ${path} never answered after ${ms(startedAt)}`, {
        server: base,
        error: String(error),
      });
      throw error;
    });
    log('net', `${method} ${path} → ${response.status} in ${ms(startedAt)}`);
    if (response.status === 401) {
      options.onSessionExpired?.();
      throw new ApiClientError(401, 'session_expired', 'Sign in again to keep syncing');
    }
    if (!response.ok) {
      const failure = await readError(response);
      log('net', `${method} ${path} refused`, { code: failure.code, message: failure.message });
      throw failure;
    }
    const payload: unknown = await response.json();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      // Worth the issue list: a response the app cannot read is almost always a server speaking a
      // different version, and the field that changed is the whole answer.
      log('net', `${method} ${path} answered something this app cannot read`, {
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
        ),
      });
      throw new ApiClientError(502, 'bad_response', 'The server sent an unexpected response');
    }
    return parsed.data;
  };

  return {
    get: (path, schema) => send(path, { method: 'GET' }, schema),
    post: (path, body, schema) =>
      send(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
        schema,
      ),
    delete: (path, schema) => send(path, { method: 'DELETE' }, schema),

    async putBinary(path, bytes, headers) {
      const startedAt = Date.now();
      const auth = await options.getAuthHeaders();
      if (auth === null) throw new ApiClientError(401, 'no_session', 'Not signed in');
      const response = await fetchImpl(
        new Request(`${base}${path}`, {
          method: 'PUT',
          credentials: 'omit',
          headers: { ...headers, ...auth },
          // Copied, not `bytes.buffer`: a `Uint8Array` may be a view onto a larger buffer, and
          // sending that buffer would upload bytes the file does not contain.
          body: new Uint8Array(bytes),
        }),
      );
      log('net', `PUT ${path} ${bytes.length} bytes → ${response.status} in ${ms(startedAt)}`);
      if (response.status === 401) {
        options.onSessionExpired?.();
        throw new ApiClientError(401, 'session_expired', 'Sign in again to keep syncing');
      }
      if (!response.ok) {
        const failure = await readError(response);
        log('net', `PUT ${path} refused`, { code: failure.code, message: failure.message });
        throw failure;
      }
    },

    async getBinary(path) {
      const startedAt = Date.now();
      const auth = await options.getAuthHeaders();
      if (auth === null) throw new ApiClientError(401, 'no_session', 'Not signed in');
      const response = await fetchImpl(
        new Request(`${base}${path}`, { method: 'GET', credentials: 'omit', headers: auth }),
      );
      if (response.status === 401) {
        options.onSessionExpired?.();
        throw new ApiClientError(401, 'session_expired', 'Sign in again to keep syncing');
      }
      if (!response.ok) {
        const failure = await readError(response);
        log('net', `GET ${path} refused`, { code: failure.code, message: failure.message });
        throw failure;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      log('net', `GET ${path} → ${bytes.length} bytes in ${ms(startedAt)}`);
      return bytes;
    },

    hasSession: async () => (await options.getAuthHeaders()) !== null,
  };
}
