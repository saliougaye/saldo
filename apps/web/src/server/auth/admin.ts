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
  /** D32: an identifier, not a credential. Synthetic (§9.1) for an account created before 0.3b. */
  email: string;
  role: string;
  revoked: boolean;
  revokedReason: string | null;
  createdAt: string;
}

/**
 * An arbitrary constant, and the only advisory lock this application takes. Its whole job is to
 * make the "who is the owner" question and its answer one indivisible step.
 */
const OWNER_CLAIM_LOCK = 0x5a1d_0001;

/**
 * §9.5. The first account on the instance is the admin; every later one is a member. Called with
 * the account row already written, and it is what writes that account's `role`.
 *
 * Two things make this safe against two ceremonies finishing at the same instant, and both are
 * needed:
 *
 * - The **advisory lock** serialises the whole claim. Counting rows outside a lock is not enough
 *   in either direction: counting *before* the insert lets both racers see an empty table and
 *   both become admin, and counting *after* it lets both see two rows and **neither** become
 *   admin, which would leave the instance with no owner at all.
 * - The rule is **"is the earliest account mine"**, not "is the table empty". The answer does not
 *   depend on when this runs relative to the other insert, so whichever racer takes the lock
 *   second sees the admin the first one wrote and settles for being a member.
 *
 * It also answers correctly on an instance that predates roles: there, the oldest account is
 * somebody else's and carries `NULL`, so a newly invited member does not inherit the server.
 * Such an instance has no admin until `promoteUser` gives it one — see `docs/self-hosting.md`.
 */
export async function claimRoleForNewUser(db: ServerDatabase, userId: string): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${OWNER_CLAIM_LOCK})`);
    const [firstEver] = await tx
      .select({ id: user.id })
      .from(user)
      // `id` breaks a tie: two accounts written in the same millisecond must still order the same
      // way for both of the racers asking.
      .orderBy(asc(user.createdAt), asc(user.id))
      .limit(1);
    const [existingAdmin] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, ADMIN_ROLE))
      .limit(1);
    const role = existingAdmin === undefined && firstEver?.id === userId ? ADMIN_ROLE : MEMBER_ROLE;
    // Written whichever it is: `createUser` leaves the column NULL, and a role that is only
    // implied by its absence is a trap for the next query that reads it.
    await tx.update(user).set({ role }).where(eq(user.id, userId));
    return role;
  });
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
      email: user.email,
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
    email: row.email,
    role: row.role ?? MEMBER_ROLE,
    revoked: row.banned === true,
    revokedReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
  }));
}
