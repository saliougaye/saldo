import { asc, desc, eq, isNotNull, max, sql } from 'drizzle-orm';
import { invites, passkey, session, syncRows, user } from '../db/schema';
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

/**
 * For a page render: the role was read with the session (`authenticate`), and `authenticate` reads
 * a banned account as signed out. A Server Action and an admin route call `isAdmin`: a mutation must not trust
 * an older read.
 */
export function isAdminUser(account: { role: string | null }): boolean {
  return account.role === ADMIN_ROLE;
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

/** What the admin's panel shows for one account: the list row, plus what only a lookup can say. */
export interface AccountDetail extends AccountSummary {
  emailVerified: boolean;
  /**
   * The newest `session.created_at`. A session row is written at sign-in, so this is the last
   * **sign-in**, not the last request; null for an account with no session left.
   */
  lastSignInAt: string | null;
  passkeyCount: number;
  /** `sync_rows` of the account, tombstones included: what deleting it would carry away. */
  syncedRows: number;
  /** The invite whose `used_by` is this account, if it came in through one. */
  invite: { id: string; label: string | null } | null;
}

export async function accountDetail(
  db: ServerDatabase,
  userId: string,
): Promise<AccountDetail | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId));
  if (row === undefined) return null;

  const [latest] = await db
    .select({ createdAt: session.createdAt })
    .from(session)
    .where(eq(session.userId, userId))
    .orderBy(desc(session.createdAt))
    .limit(1);
  const [passkeys] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(passkey)
    .where(eq(passkey.userId, userId));
  const [rows] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(syncRows)
    .where(eq(syncRows.userId, userId));
  const [invite] = await db
    .select({ id: invites.id, label: invites.label })
    .from(invites)
    .where(eq(invites.usedBy, userId))
    .limit(1);

  return {
    id: row.id,
    displayName: row.name,
    email: row.email,
    role: row.role ?? MEMBER_ROLE,
    revoked: row.banned === true,
    revokedReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
    emailVerified: row.emailVerified,
    lastSignInAt: latest?.createdAt.toISOString() ?? null,
    passkeyCount: passkeys?.n ?? 0,
    syncedRows: rows?.n ?? 0,
    invite: invite ?? null,
  };
}

/**
 * `accountDetail` for every account, in `listAccounts`'s order (oldest first). Admin → Account
 * renders the panel of each row (`PanelSwitch`), so it reads them all: five queries for the whole
 * list, not four for each account.
 */
export async function accountDetails(db: ServerDatabase): Promise<AccountDetail[]> {
  const [rows, sessions, passkeys, synced, used] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(asc(user.createdAt)),
    db
      .select({ userId: session.userId, latest: max(session.createdAt) })
      .from(session)
      .groupBy(session.userId),
    db
      .select({ userId: passkey.userId, n: sql<number>`count(*)::int` })
      .from(passkey)
      .groupBy(passkey.userId),
    db
      .select({ userId: syncRows.userId, n: sql<number>`count(*)::int` })
      .from(syncRows)
      .groupBy(syncRows.userId),
    db
      .select({ usedBy: invites.usedBy, id: invites.id, label: invites.label })
      .from(invites)
      .where(isNotNull(invites.usedBy))
      .orderBy(asc(invites.createdAt)),
  ]);
  const latest = new Map(sessions.map((row) => [row.userId, row.latest]));
  const passkeyCount = new Map(passkeys.map((row) => [row.userId, row.n]));
  const syncedRows = new Map(synced.map((row) => [row.userId, row.n]));
  const invite = new Map<string, { id: string; label: string | null }>();
  for (const row of used) {
    if (row.usedBy !== null && !invite.has(row.usedBy)) {
      invite.set(row.usedBy, { id: row.id, label: row.label });
    }
  }
  return rows.map((row) => ({
    id: row.id,
    displayName: row.name,
    email: row.email,
    role: row.role ?? MEMBER_ROLE,
    revoked: row.banned === true,
    revokedReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
    emailVerified: row.emailVerified,
    lastSignInAt: latest.get(row.id)?.toISOString() ?? null,
    passkeyCount: passkeyCount.get(row.id) ?? 0,
    syncedRows: syncedRows.get(row.id) ?? 0,
    invite: invite.get(row.id) ?? null,
  }));
}
