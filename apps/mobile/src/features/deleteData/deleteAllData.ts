import { dataEpochResponseSchema } from '@saldo/core';
import type { RepositoryDatabase } from '../../db/repositories/support';
import { wipeAccountData } from '../../db/wipe';
import { log } from '../../log';
import type { ApiClient } from '../../net/apiClient';
import type { Scheduler } from '../../sync/scheduler';

export interface DeleteAllDataDeps {
  db: RepositoryDatabase;
  /** Null on a build with no server: there is no other copy to delete. */
  api: ApiClient | null;
  scheduler: Scheduler | null;
  deleteAttachmentFiles: () => void;
}

/**
 * §8.6 "Elimina tutti i dati". The server copy goes first, and the phone is emptied only once the
 * server has said yes: deleting the phone alone would be undone by the next pull.
 *
 * Runs inside `scheduler.exclusive`, so no cycle can pull rows of the deleted generation back
 * after the phone has been emptied. Afterwards there are no settings, which the boot router reads
 * as onboarding.
 */
export async function deleteAllData(deps: DeleteAllDataDeps): Promise<void> {
  const erase = async (): Promise<void> => {
    let epoch: number | null = null;
    if (deps.api !== null) {
      ({ epoch } = await deps.api.delete('/api/data', dataEpochResponseSchema));
      log('sync', 'the server deleted the account data', { epoch });
    }
    deps.deleteAttachmentFiles();
    wipeAccountData(deps.db, epoch);
  };
  if (deps.scheduler === null) await erase();
  else await deps.scheduler.exclusive(erase);
}
