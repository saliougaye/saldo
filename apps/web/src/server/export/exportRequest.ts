import {
  type DateRange,
  type ExportFile,
  isLocalDate,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  type Settings,
  type UserData,
} from '@saldo/core';
import { PERIOD_PARAM } from '../../features/period/periodParams';
import { getDb } from '../db/client';
import { env } from '../env';
import { ApiError } from '../http/errors';
import { requireUser } from '../http/requireUser';
import { readUserData } from '../userData/read';
import { todayFor } from '../userData/today';

export interface ExportSource {
  /** The projection (§17.1.2): the only way an export reads the user's rows. */
  data: UserData;
  settings: Settings;
  /** The user's day (§17.1.5): what the file is named after, and what «current period» means. */
  today: LocalDate;
  now: Date;
}

/**
 * How both export routes begin (§11, §17.1.7). The session is whichever the request carries — the
 * browser's cookie on a download link, as `authenticate` reads it — and 401 without one. An account
 * with no settings answers 409, the phone's `NothingToExportError`: a backup without them could not
 * be restored.
 */
export async function readExport(request: Request): Promise<ExportSource> {
  const user = await requireUser(request);
  const data = await readUserData(getDb(), user.id);
  const { settings } = data;
  if (settings === null) {
    throw new ApiError(409, 'nothing_to_export', 'There are no settings to export yet');
  }
  const now = new Date();
  const { today } = todayFor(settings, env().defaultTimeZone, now);
  return { data, settings, today, now };
}

/** The query parameter that picks what the CSV covers. */
export const RANGE_PARAM = 'range';

/**
 * `range=all` (the default) is every transaction, `range=period` the period containing `p`, or
 * today without it — a date inside the range, as on every page that has a period. Unlike a page, a
 * parameter this cannot read is refused rather than replaced: a file that silently covers something
 * else than what was asked is worse than no file.
 */
export function csvRange(
  query: URLSearchParams,
  settings: Pick<Settings, 'periodKind' | 'cycleStartDay'>,
  today: LocalDate,
): DateRange | null {
  const range = query.get(RANGE_PARAM) ?? 'all';
  if (range !== 'all' && range !== 'period') {
    throw new ApiError(400, 'invalid_query', '`range` is `all` or `period`');
  }
  const date = query.get(PERIOD_PARAM);
  if (date !== null && !isLocalDate(date)) {
    throw new ApiError(400, 'invalid_query', '`p` is a date, YYYY-MM-DD');
  }
  if (range === 'all') return null;
  const def: PeriodDef = { kind: settings.periodKind, startDay: settings.cycleStartDay };
  return periodContaining(def, date ?? today);
}

/** A download: the browser saves it under the file's name and never keeps a copy in its cache. */
export function fileResponse(file: ExportFile): Response {
  return new Response(file.contents, {
    headers: {
      'content-type': `${file.mimeType}; charset=utf-8`,
      'content-disposition': `attachment; filename="${file.name}"`,
      'cache-control': 'no-store',
    },
  });
}
