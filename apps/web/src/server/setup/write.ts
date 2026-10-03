import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { log } from '../log';
import { resolveSettings } from '../settings/resolve';
import type { SettingsSource } from '../settings/serverSettings';
import { saveInstanceName, saveRegistration } from '../settings/write';
import { setupNeeded } from './state';

/** The modes step 2 offers. `first-user` is what the wizard supersedes, so it is not one of them (decision 4). */
export const SETUP_MODES = ['invite', 'open', 'closed'] as const;
export type SetupMode = (typeof SETUP_MODES)[number];

const setupInputSchema = z.object({
  /** Trimmed by `saveInstanceName`; empty deletes the row. The 60 is `instanceNameRowSchema`'s. */
  name: z.string().max(60),
  mode: z.enum(SETUP_MODES),
});

export type SetupWriteResult = { ok: true } | { ok: false; error: 'alreadySetUp' | 'invalid' };

/**
 * Step 2 of `/setup` (0.3h, decision 3). There is no session yet, so the guard is the instance's
 * own state: while no account exists, whoever is on the page is the person setting it up. A value
 * the environment sets is **skipped, not refused** — the step showed it locked, and the person is
 * saving the rest. Written by nobody (`updated_by` null), like the CLI's writes.
 */
export async function saveSetupServer(
  db: ServerDatabase,
  raw: unknown,
  now: Date,
  source: SettingsSource = env(),
): Promise<SetupWriteResult> {
  if (!(await setupNeeded(db))) return { ok: false, error: 'alreadySetUp' };
  const parsed = setupInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const resolved = resolveSettings(source, []);
  if (resolved.instanceName.source !== 'env') {
    const named = await saveInstanceName(db, null, parsed.data.name, now, source);
    if (!named.ok) return { ok: false, error: 'invalid' };
  }
  if (resolved.registration.source !== 'env') {
    const moded = await saveRegistration(db, null, parsed.data.mode, now, source);
    if (!moded.ok) return { ok: false, error: 'invalid' };
  }
  log('setup', 'the server step of the first-run wizard was saved', {
    nameLocked: resolved.instanceName.source === 'env',
    modeLocked: resolved.registration.source === 'env',
  });
  return { ok: true };
}
