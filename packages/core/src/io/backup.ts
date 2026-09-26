import { z } from 'zod';
import { settingsSchema } from '../entities';
import { userDataSchema } from '../userData';

/** Bumped only when a backup written by an older app can no longer be read (§11.1). */
export const BACKUP_VERSION = 1;

/** `UserData`, except that a backup always carries the settings: it is taken after onboarding. */
const dataSchema = userDataSchema.extend({ settings: settingsSchema });

export type BackupData = z.infer<typeof dataSchema>;

export const backupSchema = z.object({
  format: z.literal('saldo-backup'),
  version: z.number().int(),
  exportedAt: z.iso.datetime(),
  app: z.object({ version: z.string() }),
  data: dataSchema,
});

export type Backup = z.infer<typeof backupSchema>;

export interface BackupRowError {
  /** Singular entity name, as the restore screen shows it: `account`, `transaction`, … */
  entity: string;
  /** Position in its collection; always 0 for `settings`, which is a single row. */
  index: number;
  message: string;
}

export type ReadBackupFailure = {
  ok: false;
  reason: 'unreadable' | 'not-a-backup' | 'version' | 'invalid';
  errors: BackupRowError[];
};

export type ReadBackupResult = { ok: true; backup: Backup } | ReadBackupFailure;

export function buildBackup(input: {
  exportedAt: string;
  appVersion: string;
  data: BackupData;
}): Backup {
  return {
    format: 'saldo-backup',
    version: BACKUP_VERSION,
    exportedAt: input.exportedAt,
    app: { version: input.appVersion },
    data: input.data,
  };
}

/**
 * Parses and validates a backup file (§11.1). Every row is checked and the bad ones are *counted*
 * rather than skipped: a restore replaces everything on the phone, so it is all-or-nothing — a
 * partial restore would silently lose whatever the invalid rows described.
 */
export function readBackup(text: string): ReadBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'unreadable', errors: [] };
  }
  const envelope = z
    .object({ format: z.literal('saldo-backup'), version: z.number().int() })
    .safeParse(parsed);
  if (!envelope.success) return { ok: false, reason: 'not-a-backup', errors: [] };
  // A newer file may hold entities this app has never heard of, and listing every row it cannot
  // understand would bury the one thing worth saying: update the app.
  if (envelope.data.version > BACKUP_VERSION) {
    return { ok: false, reason: 'version', errors: [] };
  }
  const result = backupSchema.safeParse(parsed);
  if (result.success) return { ok: true, backup: result.data };
  return { ok: false, reason: 'invalid', errors: rowErrors(result.error) };
}

/**
 * Zod reports one issue per bad field; the screen counts rows. Issue paths look like
 * `data.accounts.3.name` (or `data.settings.currency`), so the first segments name the row and
 * everything after it is folded into that one entry.
 */
function rowErrors(error: z.ZodError): BackupRowError[] {
  const seen = new Map<string, BackupRowError>();
  for (const issue of error.issues) {
    const [root, collection, index] = issue.path;
    if (root !== 'data' || typeof collection !== 'string') continue;
    const at = typeof index === 'number' ? index : 0;
    const key = `${collection}:${at}`;
    if (seen.has(key)) continue;
    seen.set(key, { entity: singular(collection), index: at, message: issue.message });
  }
  return [...seen.values()];
}

function singular(collection: string): string {
  if (collection === 'settings') return 'settings';
  if (collection.endsWith('ies')) return `${collection.slice(0, -3)}y`;
  return collection.replace(/s$/, '');
}
