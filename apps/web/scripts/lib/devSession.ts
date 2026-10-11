/**
 * What the measuring scripts (`measure-panel.ts`, `measure-nav.ts`) share: a person signed in by
 * writing a session row and its signed cookie.
 *
 * Development only. The guard refuses anything but a local server AND a local database (the host of
 * `DATABASE_URL` must be localhost or 127.0.0.1). A script must delete the session when it ends,
 * on an error and on Ctrl-C too: `openSession` does that in `close`.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { session, user } from '../../src/server/db/authSchema';
import { closeDb, getDb } from '../../src/server/db/client';
import { env } from '../../src/server/env';

export const COOKIE = 'better-auth.session_token';
export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Throws unless the server at `base`, `PUBLIC_URL` and the database are all local. */
export function assertLocalOnly(base: string): void {
  const database = new URL(env().databaseUrl);
  if (
    !LOCAL_HOSTS.has(new URL(base).hostname) ||
    !LOCAL_HOSTS.has(new URL(env().publicUrl).hostname) ||
    !LOCAL_HOSTS.has(database.hostname) ||
    // `pg` lets `?host=` override the host of the URL.
    database.searchParams.has('host')
  ) {
    throw new Error(
      'Refused: this script signs a person in, so it runs against a local server and a local database only.',
    );
  }
}

export async function onlyUser(requested: string | undefined): Promise<string> {
  if (requested !== undefined) return requested;
  const rows = await getDb().select({ id: user.id }).from(user);
  const only = rows[0];
  if (rows.length !== 1 || only === undefined) {
    throw new Error(`${rows.length} accounts in the database: pass the userId to measure.`);
  }
  return only.id;
}

/** A session row and the cookie Better Auth signs for it: `token.base64(HMAC-SHA256(secret, token))`. */
export async function signIn(userId: string, id: string, userAgent: string): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  const signature = createHmac('sha256', env().secret).update(token).digest('base64');
  await getDb()
    .insert(session)
    .values({
      id,
      token,
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      updatedAt: new Date(),
      userAgent,
    });
  return encodeURIComponent(`${token}.${signature}`);
}

export async function deleteSession(id: string): Promise<void> {
  await getDb()
    .delete(session)
    .where(eq(session.id, id))
    .catch((error: unknown) => console.error('Could not delete the session', error));
}

export interface DevSession {
  /** The cookie to add to a browser context that opens `base`. */
  cookie(base: string): { name: string; value: string; url: string };
  /** Deletes the session and closes the database. Safe to call more than once. */
  close(): Promise<void>;
}

/**
 * Signs `userId` in. The id of the row is known before the insert, so a Ctrl-C during the insert
 * still deletes it. `beforeClose` runs first on `close` and on Ctrl-C (close the browser there).
 */
export async function openSession(
  userId: string,
  userAgent: string,
  beforeClose?: () => Promise<void>,
): Promise<DevSession> {
  const id = randomUUID();
  let signing: Promise<string> | undefined;
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closing ??= (async () => {
      await beforeClose?.().catch(() => undefined);
      // A Ctrl-C during the insert: wait for it, so that the delete finds the row.
      await signing?.catch(() => undefined);
      await deleteSession(id);
      await closeDb();
    })();
    return closing;
  };
  process.once('SIGINT', () => {
    void close().finally(() => process.exit(130));
  });
  signing = signIn(userId, id, userAgent);
  const value = await signing.catch(async (error: unknown) => {
    await close();
    throw error;
  });
  return { cookie: (base) => ({ name: COOKIE, value, url: base }), close };
}
