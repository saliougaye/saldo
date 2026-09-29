import { asc, eq } from 'drizzle-orm';
import { auth } from '../../../../src/server/auth/auth';
import { getDb } from '../../../../src/server/db/client';
import { session, user } from '../../../../src/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY — deleted by 0.3e-3's last task. Sign-in is passkey-only, so a browser driven by an
 * agent cannot sign in to check the UI. This signs the browser in as an existing account
 * (`?email=`, or the oldest account) by writing the session row Better Auth would write and setting
 * its signed cookie. It does not exist outside `next dev` and the tests, and even there only when
 * `SALDO_DEV_SIGN_IN=1` is set and the request is made to a loopback host: a dev/test environment
 * is not by itself permission to sign in as anyone.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Only a browser on this machine: the URL's host and the `Host` header must both be loopback, so a
 * dev server reachable over the LAN (`next dev -H 0.0.0.0`) does not hand sessions to the network.
 */
function fromLoopback(request: Request): boolean {
  if (!LOOPBACK.has(new URL(request.url).hostname)) return false;
  const host = request.headers.get('host');
  if (host === null) return true;
  try {
    return LOOPBACK.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

export async function GET(request: Request): Promise<Response> {
  if (
    (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') ||
    process.env.SALDO_DEV_SIGN_IN !== '1' ||
    !fromLoopback(request)
  ) {
    return new Response('Not found', { status: 404 });
  }
  const email = new URL(request.url).searchParams.get('email');
  const db = getDb();
  const [account] =
    email === null
      ? await db.select().from(user).orderBy(asc(user.createdAt)).limit(1)
      : await db.select().from(user).where(eq(user.email, email.toLowerCase())).limit(1);
  if (account === undefined) return new Response('No such user', { status: 404 });

  const token = crypto.randomUUID().replaceAll('-', '');
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId: account.id,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    updatedAt: new Date(),
  });

  // Better Auth's signed cookie: `token.base64(HMAC-SHA256(secret, token))`, URI-encoded.
  const { secret, authCookies } = await auth().$context;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  const signature = Buffer.from(mac).toString('base64');
  const value = encodeURIComponent(`${token}.${signature}`);
  const name = authCookies.sessionToken.name;

  return new Response(null, {
    status: 303,
    headers: {
      location: new URL('/home', request.url).toString(),
      'set-cookie': `${name}=${value}; Path=/; HttpOnly; SameSite=Lax`,
    },
  });
}
