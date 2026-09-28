import { eq } from 'drizzle-orm';
import type { StoredPasskey } from '../../features/passkeys/list';
import { passkey } from '../db/schema';
import type { ServerDatabase } from '../db/types';

/**
 * The passkeys of one account, for `/profile/passkeys`. Read straight from the table rather than
 * through `auth.api.listPasskeys` because a Server Component wants typed rows and no public key: the
 * page shows a name, an authenticator and a date, and nothing here should ever reach a browser that
 * the page does not draw.
 */
export async function listPasskeysForUser(
  db: ServerDatabase,
  userId: string,
): Promise<StoredPasskey[]> {
  const rows = await db
    .select({
      id: passkey.id,
      name: passkey.name,
      credentialId: passkey.credentialID,
      aaguid: passkey.aaguid,
      backedUp: passkey.backedUp,
      createdAt: passkey.createdAt,
    })
    .from(passkey)
    .where(eq(passkey.userId, userId));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    credentialId: row.credentialId,
    aaguid: row.aaguid,
    backedUp: row.backedUp,
    createdAt: row.createdAt === null ? null : row.createdAt.toISOString(),
  }));
}
