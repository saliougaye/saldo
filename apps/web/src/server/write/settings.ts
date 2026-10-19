import { type Settings, settingsSchema } from '@saldo/core';
import { canonicalTimeZone, isTimeZone } from '@saldo/i18n';
import { z } from 'zod';
import type { ServerDatabase } from '../db/types';
import { readUserData } from '../userData/read';
import { unstamped } from './rows';
import { WriteRefused, writeInTransaction } from './writeChanges';

const shape = settingsSchema.shape;

/**
 * One preference, as Profilo's panels send it (§6.8): the phone's `repos.settings.update` takes one
 * field at a time too.
 */
export const settingInputSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('language'), value: shape.language }),
  z.object({ key: z.literal('theme'), value: shape.theme }),
  z.object({ key: z.literal('currency'), value: shape.currency }),
  z.object({ key: z.literal('periodKind'), value: shape.periodKind }),
  // §5.2: the grid stops at 28, a day every month has. The entity's own schema allows up to 31
  // (a row an older build wrote), so the range is stated here.
  z.object({ key: z.literal('cycleStartDay'), value: z.number().int().min(1).max(28) }),
  // Core has no `Intl`, so its schema takes any name; the server is where a zone is checked (§17.1.5).
  z.object({ key: z.literal('timeZone'), value: z.string().min(1).max(64).refine(isTimeZone) }),
]);

export type SettingInput = z.infer<typeof settingInputSchema>;
export type SettingKey = SettingInput['key'];
export type SettingWriteError = 'invalid' | 'notFound' | 'conflict';
export type SettingResult = { ok: true } | { ok: false; error: SettingWriteError };

/** The field as it will be stored, or null when the row already says so. */
function change(current: Settings, input: SettingInput): Partial<Settings> | null {
  if (input.key === 'timeZone') {
    // Compared and stored by the id the list holds: a phone reports Asia/Kolkata, CLDR lists Asia/Calcutta.
    const zone = canonicalTimeZone(input.value);
    const saved = current.timeZone ?? null;
    return saved !== null && canonicalTimeZone(saved) === zone ? null : { timeZone: zone };
  }
  return current[input.key] === input.value ? null : { [input.key]: input.value };
}

/**
 * Writes the settings row back with one field changed. An account with no settings has never
 * onboarded, and a preference is not what creates the row (`notFound`); a value already stored
 * writes nothing, so choosing the selected option again does not stamp the row.
 */
export async function saveSetting(
  db: ServerDatabase,
  userId: string,
  raw: unknown,
  now: Date,
): Promise<SettingResult> {
  const parsed = settingInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const input = parsed.data;
  try {
    return await writeInTransaction<SettingResult>(db, userId, now, async (tx) => {
      const { settings } = await readUserData(tx, userId);
      if (settings === null) return { writes: [], result: { ok: false, error: 'notFound' } };
      const changed = change(settings, input);
      if (changed === null) return { writes: [], result: { ok: true } };
      return {
        writes: [
          {
            entity: 'settings',
            id: settings.id,
            data: { ...unstamped(settings), ...changed },
            basis: settings.updatedAt,
          },
        ],
        result: { ok: true },
      };
    });
  } catch (error) {
    if (error instanceof WriteRefused) return { ok: false, error: error.reason };
    throw error;
  }
}
