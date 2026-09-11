import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { invites } from '../db/schema';
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
}

interface InviteRow {
  id: string;
  label: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: string | null;
  revokedAt: Date | null;
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
  return { code, invite: summarise(row, input.now) };
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
export async function inviteIsUsable(db: ServerDatabase, code: string, now: Date): Promise<boolean> {
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
 */
export async function burnInvite(
  db: ServerDatabase,
  code: string,
  userId: string,
  now: Date,
): Promise<string | null> {
  const [row] = await db
    .update(invites)
    .set({ usedAt: now, usedBy: userId })
    .where(usableWhere(hashInviteCode(code), now))
    .returning({ id: invites.id });
  return row?.id ?? null;
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
  const rows = await db
    .select({
      id: invites.id,
      label: invites.label,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      usedBy: invites.usedBy,
      revokedAt: invites.revokedAt,
    })
    .from(invites)
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
