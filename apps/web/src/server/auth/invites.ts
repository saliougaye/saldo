import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { invites, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { generateInviteCode, hashInviteCode } from './inviteCode';

export const DEFAULT_INVITE_TTL_DAYS = 7;
export const MAX_INVITE_TTL_DAYS = 90;
export const MAX_INVITE_LABEL_LENGTH = 80;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What an invite is, once it is no longer a code. `used` wins over `revoked`: it already worked. */
export type InviteStatus = 'active' | 'used' | 'revoked' | 'expired';

export interface InviteSummary {
  id: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: string | null;
  revokedAt: string | null;
  status: InviteStatus;
  /** The display name of whoever minted it; null for a CLI mint, or when that account is gone. */
  createdByName: string | null;
  /** The address of whoever spent it; null while unspent, or when that account is gone. */
  usedByEmail: string | null;
}

interface InviteRow {
  id: string;
  label: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: string | null;
  revokedAt: Date | null;
  createdByName: string | null;
  usedByEmail: string | null;
}

export interface CreateInviteInput {
  label: string | null;
  ttlDays: number;
  /** Null when the CLI minted it: it runs with no session, and on a fresh server there is none. */
  createdBy: string | null;
  now: Date;
}

function summarise(row: InviteRow, now: Date): InviteSummary {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
    usedBy: row.usedBy,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdByName: row.createdByName,
    usedByEmail: row.usedByEmail,
    status:
      row.usedAt !== null
        ? 'used'
        : row.revokedAt !== null
          ? 'revoked'
          : row.expiresAt.getTime() <= now.getTime()
            ? 'expired'
            : 'active',
  };
}

/**
 * The one moment the code exists in the clear. It is returned to the caller and nowhere else: the
 * row holds a sha-256, so this value cannot be recovered from the server afterwards.
 */
export async function createInvite(
  db: ServerDatabase,
  input: CreateInviteInput,
): Promise<{ code: string; invite: InviteSummary }> {
  const code = generateInviteCode();
  const row = {
    id: crypto.randomUUID(),
    codeHash: hashInviteCode(code),
    label: input.label,
    createdBy: input.createdBy,
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + input.ttlDays * DAY_MS),
    usedAt: null,
    usedBy: null,
    revokedAt: null,
  };
  await db.insert(invites).values(row);
  const [minter] =
    input.createdBy === null
      ? []
      : await db.select({ name: user.name }).from(user).where(eq(user.id, input.createdBy));
  return {
    code,
    invite: summarise(
      { ...row, createdByName: minter?.name ?? null, usedByEmail: null },
      input.now,
    ),
  };
}

/** The conditions under which a code opens the door, in one place so the two callers agree. */
function usableWhere(codeHash: string, now: Date) {
  return and(
    eq(invites.codeHash, codeHash),
    isNull(invites.usedAt),
    isNull(invites.revokedAt),
    // `>` and not `>=`: an invite is dead **on** its deadline, not a second after it.
    gt(invites.expiresAt, now),
  );
}

/**
 * Asked before the WebAuthn ceremony starts, so a bad code fails before the phone asks for a
 * fingerprint. It deliberately does not say *why* a code is no good — unknown, spent, revoked and
 * expired are one answer to the caller, so the form cannot be used to probe the table.
 */
export async function inviteIsUsable(
  db: ServerDatabase,
  code: string,
  now: Date,
): Promise<boolean> {
  const [row] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(usableWhere(hashInviteCode(code), now));
  return row !== undefined;
}

/**
 * Spends the invite, returning its id, or null if there was nothing to spend. One conditional
 * `UPDATE`: Postgres locks the matching row, so of two ceremonies racing on one code exactly one
 * gets a row back. Reading first and writing after would let both of them in.
 *
 * It sets `used_at` and **not** `used_by`, because it runs before the account exists — that is the
 * whole point of the ordering, and `used_by` has a foreign key to `user`, so naming somebody here
 * would refuse every registration on an empty instance. `attributeInvite` fills the name in once
 * there is a row to point at. What makes the invite spent is `used_at`, which `usableWhere` reads
 * and this statement writes: the code is dead the instant this returns, attributed or not.
 */
export async function burnInvite(
  db: ServerDatabase,
  code: string,
  now: Date,
): Promise<string | null> {
  const [row] = await db
    .update(invites)
    .set({ usedAt: now })
    .where(usableWhere(hashInviteCode(code), now))
    .returning({ id: invites.id });
  return row?.id ?? null;
}

/**
 * Records which account a spent invite let in. Deliberately separate from the burn and deliberately
 * not load-bearing: if it never runs, the invite is still spent and the account still exists — the
 * owner just sees a used invite with nobody's name on it.
 */
export async function attributeInvite(
  db: ServerDatabase,
  id: string,
  userId: string,
): Promise<void> {
  await db.update(invites).set({ usedBy: userId }).where(eq(invites.id, id));
}

/**
 * Undoes a burn. The registration hook spends the invite **before** it writes the account, so that
 * two ceremonies cannot both proceed; if the write then fails, the person still holds a code that
 * never let them in, and this is what makes it work again.
 */
export async function releaseInvite(db: ServerDatabase, id: string): Promise<void> {
  await db.update(invites).set({ usedAt: null, usedBy: null }).where(eq(invites.id, id));
}

export async function listInvites(db: ServerDatabase, now: Date): Promise<InviteSummary[]> {
  // Two joins on the same table, hence the alias. Left joins: `created_by` and `used_by` are both
  // nullable, and an invite must not vanish from the list because its account was deleted.
  const minter = alias(user, 'minter');
  const spender = alias(user, 'spender');
  const rows = await db
    .select({
      id: invites.id,
      label: invites.label,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      usedBy: invites.usedBy,
      revokedAt: invites.revokedAt,
      createdByName: minter.name,
      usedByEmail: spender.email,
    })
    .from(invites)
    .leftJoin(minter, eq(minter.id, invites.createdBy))
    .leftJoin(spender, eq(spender.id, invites.usedBy))
    .orderBy(desc(invites.createdAt));
  return rows.map((row) => summarise(row, now));
}

/** Reports whether there was an invite to revoke, so the route can answer 404 rather than lie. */
export async function revokeInvite(db: ServerDatabase, id: string, now: Date): Promise<boolean> {
  const [row] = await db
    .update(invites)
    .set({ revokedAt: now })
    .where(and(eq(invites.id, id), isNull(invites.revokedAt)))
    .returning({ id: invites.id });
  return row !== undefined;
}
