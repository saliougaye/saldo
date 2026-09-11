import type { z } from 'zod';

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
    const auth = await options.getAuthHeaders();
    if (auth === null) throw new ApiClientError(401, 'no_session', 'Not signed in');
    const response = await fetchImpl(
      new Request(`${base}${path}`, {
        ...init,
        // `omit` so the platform does not also attach its own cookie jar and confuse the server.
        credentials: 'omit',
        headers: { ...(init.headers as Record<string, string> | undefined), ...auth },
      }),
    );
    if (response.status === 401) {
      options.onSessionExpired?.();
      throw new ApiClientError(401, 'session_expired', 'Sign in again to keep syncing');
    }
    if (!response.ok) throw await readError(response);
    const payload: unknown = await response.json();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
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

    async putBinary(path, bytes, headers) {
      const auth = await options.getAuthHeaders();
      if (auth === null) throw new ApiClientError(401, 'no_session', 'Not signed in');
      const response = await fetchImpl(
        new Request(`${base}${path}`, {
          method: 'PUT',
          credentials: 'omit',
          headers: { ...headers, ...auth },
          // `Uint8Array<ArrayBufferLike>` is not a `BodyInit`; the buffer behind it is.
          body: bytes.buffer as ArrayBuffer,
        }),
      );
      if (response.status === 401) {
        options.onSessionExpired?.();
        throw new ApiClientError(401, 'session_expired', 'Sign in again to keep syncing');
      }
      if (!response.ok) throw await readError(response);
    },

    async getBinary(path) {
      const auth = await options.getAuthHeaders();
      if (auth === null) throw new ApiClientError(401, 'no_session', 'Not signed in');
      const response = await fetchImpl(
        new Request(`${base}${path}`, { method: 'GET', credentials: 'omit', headers: auth }),
      );
      if (response.status === 401) {
        options.onSessionExpired?.();
        throw new ApiClientError(401, 'session_expired', 'Sign in again to keep syncing');
      }
      if (!response.ok) throw await readError(response);
      return new Uint8Array(await response.arrayBuffer());
    },

    hasSession: async () => (await options.getAuthHeaders()) !== null,
  };
}
