import { APIError, createAuthMiddleware } from 'better-auth/api';

/** The four endpoints whose links Saldo mails, and the fields in which a caller can name a redirect. */
const GUARDED_PATHS = new Set([
  '/sign-in/magic-link',
  '/send-verification-email',
  '/magic-link/verify',
  '/verify-email',
]);
const CALLBACK_FIELDS = ['callbackURL', 'errorCallbackURL', 'newUserCallbackURL'] as const;

/** A path on this site: one slash, not two (`//host`), no backslash a browser reads as a slash. */
export function isRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
}

/**
 * 0.3f-3 review, finding A. `saldo://` is a trusted origin for the phone's own flows, so Better
 * Auth's origin check lets `callbackURL: "saldo://steal"` through; when the link is opened the Expo
 * plugin then redirects there with the session cookie appended, to whichever app claims the scheme.
 * Nothing in the recovery or verification flows has a reason to leave the site, and the phone app
 * does not call these endpoints, so any callback that is not a path on this site is refused, before
 * a token is minted or spent. (The mailed links are rebuilt in `mailCallbacks.ts` as well: this is
 * the second lock, not the only one.)
 */
export const mailCallbackGuard = createAuthMiddleware(async (ctx) => {
  if (!GUARDED_PATHS.has(ctx.path)) return;
  for (const source of [ctx.body, ctx.query]) {
    if (typeof source !== 'object' || source === null) continue;
    for (const field of CALLBACK_FIELDS) {
      const value: unknown = Reflect.get(source, field);
      if (value === undefined || value === null || value === '') continue;
      if (typeof value !== 'string' || !isRelativePath(decodeQuery(value))) {
        throw APIError.from('FORBIDDEN', {
          code: 'INVALID_CALLBACK_URL',
          message: 'Invalid callback URL',
        });
      }
    }
  }
});

function decodeQuery(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 0.3f-3 review, finding D. A link minted before an account was revoked is refused by the `admin`
 * plugin's session hook, which throws `FORBIDDEN BANNED_USER` — as JSON, to a browser that followed a
 * link from a mail. Here that one error becomes what every other failure of this endpoint already is:
 * a redirect to the error callback (`/recover?error=BANNED_USER`, which `/recover` reads as «this link
 * no longer works», telling nothing about why). The token was spent, and no session exists. It returns
 * a `Response` rather than throwing `ctx.redirect`: a thrown redirect keeps the 403 of the error it
 * replaces, and a browser does not follow a 403.
 */
export const revokedLinkRedirect = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/magic-link/verify') return;
  const returned: unknown = ctx.context.returned;
  if (!(returned instanceof APIError) || returned.body?.code !== 'BANNED_USER') return;
  const query: unknown = ctx.query;
  const requested =
    typeof query === 'object' && query !== null
      ? Reflect.get(query, 'errorCallbackURL')
      : undefined;
  const target = new URL(
    typeof requested === 'string' && isRelativePath(decodeQuery(requested))
      ? decodeQuery(requested)
      : '/',
    ctx.context.baseURL,
  );
  target.searchParams.set('error', 'BANNED_USER');
  return new Response(null, { status: 302, headers: { location: target.toString() } });
});
