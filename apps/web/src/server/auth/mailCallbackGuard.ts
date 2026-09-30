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
