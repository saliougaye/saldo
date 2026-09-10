import type { z } from 'zod';
import type { TokenStore, Tokens } from '../auth/tokenStore';

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
  /** Whether a session is stored for this server. */
  hasSession(): Promise<boolean>;
}

export interface ApiClientOptions {
  serverUrl: string;
  store: TokenStore;
  onSessionExpired?: () => void;
  fetchImpl?: (request: Request) => Promise<Response>;
}

export interface TokenPairBody {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; displayName: string };
}

export function tokensFromBody(body: TokenPairBody, now: number): Tokens {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now + body.expires_in * 1000,
    userId: body.user.id,
    displayName: body.user.displayName,
  };
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
 * The one place that talks to the server. It attaches the bearer, and on a 401 it refreshes
 * **once** and retries. The refresh is shared between concurrent callers on purpose: the server
 * revokes a whole refresh chain when a token is presented twice (§9.3 step 6), so two parallel
 * refreshes would sign the device out.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? ((request: Request) => fetch(request));
  const base = options.serverUrl.replace(/\/$/, '');
  let refreshing: Promise<Tokens | null> | null = null;

  const refresh = async (current: Tokens): Promise<Tokens | null> => {
    const response = await fetchImpl(
      new Request(`${base}/api/auth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken,
        }),
      }),
    );
    if (!response.ok) {
      await options.store.clear(options.serverUrl);
      options.onSessionExpired?.();
      return null;
    }
    const body = (await response.json()) as TokenPairBody;
    const next = tokensFromBody(body, Date.now());
    await options.store.save(options.serverUrl, next);
    return next;
  };

  const refreshOnce = (current: Tokens): Promise<Tokens | null> => {
    refreshing ??= refresh(current).finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const send = async <T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T>,
    retried = false,
  ): Promise<T> => {
    const stored = await options.store.load(options.serverUrl);
    if (stored === null) throw new ApiClientError(401, 'no_session', 'Not signed in');
    const request = new Request(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        authorization: `Bearer ${stored.accessToken}`,
      },
    });
    const response = await fetchImpl(request);
    if (response.status === 401 && !retried) {
      const refreshed = await refreshOnce(stored);
      if (refreshed === null) throw await readError(response);
      return send(path, init, schema, true);
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
    hasSession: async () => (await options.store.load(options.serverUrl)) !== null,
  };
}
