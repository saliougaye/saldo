import { eq } from 'drizzle-orm';
import { user } from '../db/schema';
import type { ServerDatabase } from '../db/types';

/** The registration form's limit on the name (`RegisterFlow`), kept here too: the form is a courtesy. */
export const MAX_DISPLAY_NAME_LENGTH = 80;

export type RenameAccountResult =
  | { ok: true; name: string }
  | { ok: false; reason: 'empty' | 'tooLong' | 'notFound' };

/**
 * Profilo → Nome: the account's display name, the one the head, the avatar menu and the admin's list
 * show. The input comes from the browser, so it is `unknown` until here. Blanks at either end go;
 * an empty name is refused, as the registration refuses one (`display_name_required`).
 *
 * The caller passes the id of the session's account (`requireWebUser`), never one from the request:
 * that is what keeps a person to their own name. `getSession` reads the user row on every call
 * (`session.ts`), so the next request already shows the new name.
 */
export async function renameAccount(
  db: ServerDatabase,
  userId: string,
  input: unknown,
  now: Date,
): Promise<RenameAccountResult> {
  const name = typeof input === 'string' ? input.trim() : '';
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if (name.length > MAX_DISPLAY_NAME_LENGTH) return { ok: false, reason: 'tooLong' };
  const [row] = await db
    .update(user)
    .set({ name, updatedAt: now })
    .where(eq(user.id, userId))
    .returning({ name: user.name });
  if (row === undefined) return { ok: false, reason: 'notFound' };
  return { ok: true, name: row.name };
}
