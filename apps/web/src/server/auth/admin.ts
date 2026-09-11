import { asc, eq, sql } from 'drizzle-orm';
import { session, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';

/**
 * The role better-auth's `admin` plugin treats as an administrator (its `adminRoles` default), and
 * the one `requireAdmin` checks. Saldo has exactly two roles: this, and everybody else.
 */
export const ADMIN_ROLE = 'admin';
export const MEMBER_ROLE = 'user';

export interface AccountSummary {
  id: string;
  displayName: string;
  role: string;
  revoked: boolean;
  revokedReason: string | null;
  createdAt: string;
}

/**
 * §9.5. The first account on the instance is the admin. Under `REGISTRATION=invite` that account
 * can only be created with a code minted by the CLI, so "the first account" and "whoever installed
 * this server" are the same person by construction — there is no race to win.
 */
export async function roleForNewUser(db: ServerDatabase): Promise<string> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  return (row?.count ?? 0) === 0 ? ADMIN_ROLE : MEMBER_ROLE;
}

/** A revoked account is not an admin, whatever its role says. */
export async function isAdmin(db: ServerDatabase, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: user.role, banned: user.banned })
    .from(user)
    .where(eq(user.id, userId));
  if (row === undefined || row.banned === true) return false;
  return row.role === ADMIN_ROLE;
}

export async function isRevoked(db: ServerDatabase, userId: string): Promise<boolean> {
  const [row] = await db.select({ banned: user.banned }).from(user).where(eq(user.id, userId));
  return row?.banned === true;
}

/**
 * Throws somebody out without destroying anything they wrote. Two writes, both needed: the flag
 * stops better-auth from ever creating another session for them, and deleting the session rows
 * kills the bearer they are holding right now — the plugin's own check runs at session *creation*,
 * so it would not touch a live one.
 */
export async function revokeUser(
  db: ServerDatabase,
  userId: string,
  reason: string | null,
  now: Date,
): Promise<boolean> {
  const [row] = await db
    .update(user)
    .set({ banned: true, banReason: reason, banExpires: null, updatedAt: now })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  if (row === undefined) return false;
  await db.delete(session).where(eq(session.userId, userId));
  return true;
}

export async function restoreUser(db: ServerDatabase, userId: string): Promise<boolean> {
  const [row] = await db
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  return row !== undefined;
}

/** Irreversible: the foreign keys carry away the sessions, the passkeys and every synced row. */
export async function deleteUser(db: ServerDatabase, userId: string): Promise<boolean> {
  const [row] = await db.delete(user).where(eq(user.id, userId)).returning({ id: user.id });
  return row !== undefined;
}

export async function promoteUser(db: ServerDatabase, userId: string): Promise<boolean> {
  const [row] = await db
    .update(user)
    .set({ role: ADMIN_ROLE })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  return row !== undefined;
}

export async function listAccounts(db: ServerDatabase): Promise<AccountSummary[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.createdAt));
  return rows.map((row) => ({
    id: row.id,
    displayName: row.name,
    role: row.role ?? MEMBER_ROLE,
    revoked: row.banned === true,
    revokedReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
  }));
}
