import { drainDeletedBlobs, MAX_DELETIONS_PER_PUSH } from '../../../src/server/attachments/cleanup';
import { getDb } from '../../../src/server/db/client';
import { handle } from '../../../src/server/http/errors';
import { requireUser } from '../../../src/server/http/requireUser';
import { log, shortId } from '../../../src/server/log';
import { getStore } from '../../../src/server/storage';
import { deleteAccountData, readEpoch } from '../../../src/server/sync/epoch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** §8.6: which generation of its data the account is on. */
export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser(request);
    return Response.json({ epoch: await readEpoch(getDb(), user.id) });
  });
}

/** §8.6: deletes every synced row and attachment of the account. The account itself stays. */
export function DELETE(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    const user = await requireUser(request);
    const epoch = await deleteAccountData(getDb(), user.id, now);
    log('sync', `deleted all data of ${shortId(user.id)}`, { epoch });

    // The bytes go after the answer, and their failures stay here, as on push (§10): the rows are
    // already gone, and whatever is left in the queue is drained by later pushes.
    void (async () => {
      const store = await getStore();
      if (store === null) return;
      let deleted = MAX_DELETIONS_PER_PUSH;
      while (deleted === MAX_DELETIONS_PER_PUSH) {
        deleted = await drainDeletedBlobs(getDb(), store, now);
      }
    })().catch((error: unknown) => {
      console.error('[saldo] blob cleanup after a data deletion failed', error);
    });

    return Response.json({ epoch });
  });
}
