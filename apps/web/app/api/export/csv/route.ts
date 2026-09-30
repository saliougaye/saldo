import { csvFile } from '@saldo/core';
import { csvRange, fileResponse, readExport } from '../../../../src/server/export/exportRequest';
import { handle } from '../../../../src/server/http/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** §11.2, from the web: `?range=all` (default) or `?range=period`, with `&p=` for another period. */
export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const { data, settings, today } = await readExport(request);
    const range = csvRange(new URL(request.url).searchParams, settings, today);
    return fileResponse(csvFile(data, { today, range }));
  });
}
