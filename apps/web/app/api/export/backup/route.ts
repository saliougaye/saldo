import { backupFile } from '@saldo/core';
import { fileResponse, readExport } from '../../../../src/server/export/exportRequest';
import { handle } from '../../../../src/server/http/errors';
import { APP_VERSION } from '../../../../src/server/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * §11.1, from the web (§17.1.7): the JSON backup the phone writes, built by the same function, so
 * a file taken here restores there. It carries the attachments' rows, not their bytes — the ZIP
 * with the files stays the phone's (§17.1.9).
 */
export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { data, today, now } = await readExport(request);
    return fileResponse(
      backupFile(data, { today, exportedAt: now.toISOString(), appVersion: APP_VERSION }),
    );
  });
}
