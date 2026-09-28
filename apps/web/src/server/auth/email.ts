import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { user } from '../db/schema';
import type { ServerDatabase } from '../db/types';

/**
 * §9.1 gave passkey-only accounts an address in this domain, before D32 required a real one. RFC
 * 2606 reserves `.invalid`, so it can never route anywhere — which is what makes it safe to treat
 * as "this account has no email yet".
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'passkey.saldo.invalid';

/** The longest address SMTP carries. */
export const MAX_EMAIL_LENGTH = 254;

const schema = z
  .string()
  .trim()
  .max(MAX_EMAIL_LENGTH)
  .transform((value) => value.toLowerCase())
  .pipe(z.email());

/**
 * The stored spelling of what somebody typed, or `null` when it is not an address. Lowercased
 * because the address is an **identifier** (D32) and `Ada@` and `ada@` must not be two accounts.
 */
export function normaliseEmail(input: string): string | null {
  const parsed = schema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function syntheticEmail(userId: string): string {
  return `${userId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** Whether this account is still on the pre-D32 placeholder, and so may be given a real address. */
export function isSyntheticEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  return at !== -1 && email.slice(at + 1).toLowerCase() === SYNTHETIC_EMAIL_DOMAIN;
}

/**
 * Whether some other account already has this address. `lower(email)` rather than a plain compare:
 * rows written before this task exist in whatever case Better Auth was given, and the unique index
 * is on the column, not on its lower case — so this answer and the index can disagree only for
 * those, which is why the index stays the real guard (see `registration.ts`).
 */
export async function emailIsTaken(
  db: ServerDatabase,
  email: string,
  exceptUserId?: string,
): Promise<boolean> {
  const sameAddress = eq(sql`lower(${user.email})`, email.toLowerCase());
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(exceptUserId === undefined ? sameAddress : and(sameAddress, ne(user.id, exceptUserId)))
    .limit(1);
  return row !== undefined;
}
