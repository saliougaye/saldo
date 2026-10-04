import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';

/**
 * §17.4.1: every client is public (PKCE S256, no secret) and its redirect URIs are `https://` or
 * loopback (`http://localhost`, `http://127.0.0.1`, any port).
 *
 * The plugin alone would do otherwise: a client that omits `token_endpoint_auth_method` becomes
 * confidential (`client_secret_basic`) and gets a secret, and the default `application_type: "web"`
 * refuses `http://localhost` — which is exactly what Claude Code registers. So the body is checked
 * and completed here, before the plugin sees it.
 */
export type RegistrationCheck =
  | { ok: true; body: Record<string, unknown> }
  | {
      ok: false;
      error: 'invalid_redirect_uri' | 'invalid_client_metadata';
      description: string;
    };

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

function redirectKind(uri: string): 'https' | 'loopback' | null {
  if (!URL.canParse(uri) || uri.includes('#')) return null;
  const url = new URL(uri);
  if (url.username !== '' || url.password !== '') return null;
  if (url.protocol === 'https:') return LOOPBACK_HOSTS.has(url.hostname) ? null : 'https';
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return 'loopback';
  return null;
}

export function checkRegistration(raw: unknown): RegistrationCheck {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: 'The registration must be a JSON object',
    };
  }
  const body: Record<string, unknown> = Object.fromEntries(Object.entries(raw));
  const method = body.token_endpoint_auth_method;
  if (method !== undefined && method !== 'none') {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: 'Only public clients may register: token_endpoint_auth_method must be "none"',
    };
  }
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0) {
    return { ok: false, error: 'invalid_redirect_uri', description: 'redirect_uris is required' };
  }
  let loopback = false;
  for (const uri of uris) {
    const kind = typeof uri === 'string' ? redirectKind(uri) : null;
    if (kind === null) {
      return {
        ok: false,
        error: 'invalid_redirect_uri',
        description:
          'Redirect URIs must be https:// on a public host, or http://localhost / http://127.0.0.1',
      };
    }
    if (kind === 'loopback') loopback = true;
  }
  return {
    ok: true,
    body: {
      ...body,
      token_endpoint_auth_method: 'none',
      // The plugin refuses loopback for `web`; `native` also accepts https on a public host.
      application_type: loopback ? 'native' : (body.application_type ?? 'web'),
    },
  };
}

/** `POST /api/auth/oauth2/register` passes through `checkRegistration` first. */
export function mcpRegistrationGuard() {
  return {
    id: 'saldo-mcp-registration',
    hooks: {
      before: [
        {
          matcher: (context: { path?: string }) => context.path === '/oauth2/register',
          handler: createAuthMiddleware(async (ctx) => {
            const checked = checkRegistration(ctx.body);
            if (!checked.ok) {
              throw new APIError('BAD_REQUEST', {
                error: checked.error,
                error_description: checked.description,
              });
            }
            return { context: { body: checked.body } };
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
