import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { normaliseEmail } from '../auth/email';
import { serverSettings } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { log, shortId } from '../log';
import {
  instanceNameRowSchema,
  registrationRowSchema,
  resolveSettings,
  smtpRowSchema,
} from './resolve';
import { encryptSecret } from './secret';
import { type SettingsSource, SMTP_PASSWORD_SLOT } from './serverSettings';

/**
 * §17.1.8, decision 7. The writes behind `/admin/settings`, as results and never throws (§17.1.3):
 * `locked` when the environment sets the value — decided **here**, from the resolver, not from what
 * the form showed — and `invalid` when the input is no good. Every write upserts on `key` and
 * stamps who and when. Like the readers, each takes the environment part last so a test can state
 * «the environment locks it» without touching `process.env`.
 */
export type SettingsWriteResult =
  | { ok: true }
  | { ok: false; error: 'locked' | 'invalid' | 'passwordRequired' };

const OK = { ok: true } as const;
const LOCKED = { ok: false, error: 'locked' } as const;
const INVALID = { ok: false, error: 'invalid' } as const;
const PASSWORD_REQUIRED = { ok: false, error: 'passwordRequired' } as const;

async function upsert(
  db: ServerDatabase,
  actorId: string | null,
  key: string,
  value: unknown,
  now: Date,
): Promise<void> {
  await db
    .insert(serverSettings)
    .values({ key, value, updatedAt: now, updatedBy: actorId })
    .onConflictDoUpdate({
      target: serverSettings.key,
      set: { value, updatedAt: now, updatedBy: actorId },
    });
}

export async function saveRegistration(
  db: ServerDatabase,
  actorId: string | null,
  raw: unknown,
  now: Date,
  source: SettingsSource = env(),
): Promise<SettingsWriteResult> {
  if (resolveSettings(source, []).registration.source === 'env') return LOCKED;
  const mode = registrationRowSchema.safeParse(raw);
  if (!mode.success) return INVALID;
  await upsert(db, actorId, 'registration', mode.data, now);
  log('settings', 'registration mode saved', { by: shortId(actorId), mode: mode.data });
  return OK;
}

/** The empty string deletes the row, and the name falls back to `WEBAUTHN_RP_NAME`. */
export async function saveInstanceName(
  db: ServerDatabase,
  actorId: string | null,
  raw: unknown,
  now: Date,
  source: SettingsSource = env(),
): Promise<SettingsWriteResult> {
  if (resolveSettings(source, []).instanceName.source === 'env') return LOCKED;
  if (typeof raw !== 'string') return INVALID;
  if (raw.trim() === '') {
    await db.delete(serverSettings).where(eq(serverSettings.key, 'instanceName'));
    log('settings', 'instance name cleared', { by: shortId(actorId) });
    return OK;
  }
  const name = instanceNameRowSchema.safeParse(raw);
  if (!name.success) return INVALID;
  await upsert(db, actorId, 'instanceName', name.data, now);
  log('settings', 'instance name saved', { by: shortId(actorId) });
  return OK;
}

/** `name <addr>` or `addr`: the address is checked with the rule accounts use, the name may not break a header. */
function isMailbox(value: string): boolean {
  if (value.length > 320 || /[\r\n]/.test(value)) return false;
  const named = /^[^<>]*<([^<>\s]+)>$/.exec(value);
  const address = named?.[1] ?? value;
  return !/\s/.test(address) && normaliseEmail(address) !== null;
}

const smtpInputSchema = z.object({
  host: z.string().trim().min(1).max(255).regex(/^\S+$/),
  port: z.coerce.number().int().min(1).max(65535),
  user: z
    .string()
    .trim()
    .max(255)
    .nullish()
    .transform((value) => (value === undefined || value === null || value === '' ? null : value)),
  from: z.string().trim().min(1).refine(isMailbox),
  /** Absent keeps the stored password; a string replaces it; `null` removes it. */
  password: z.string().min(1).max(1024).nullable().optional(),
});

export async function saveSmtp(
  db: ServerDatabase,
  actorId: string | null,
  raw: unknown,
  now: Date,
  source: SettingsSource = env(),
): Promise<SettingsWriteResult> {
  if (resolveSettings(source, []).smtp.source === 'env') return LOCKED;
  const input = smtpInputSchema.safeParse(raw);
  if (!input.success) return INVALID;
  const { host, port, user, from, password } = input.data;

  let stored: string | null;
  if (password === undefined) {
    // Keep: whatever envelope is there, untouched. A row that no longer parses keeps nothing.
    const [row] = await db.select().from(serverSettings).where(eq(serverSettings.key, 'smtp'));
    const current = smtpRowSchema.safeParse(row?.value);
    stored = current.success ? current.data.password : null;
    // The stored password may only go where it was sent before: a new host or user with the old
    // password would let a stolen admin session point it at a server of its own (write-only).
    if (
      current.success &&
      stored !== null &&
      (current.data.host !== host || current.data.user !== user)
    ) {
      return PASSWORD_REQUIRED;
    }
  } else if (password === null) {
    stored = null;
  } else {
    stored = encryptSecret(password, source.settingsKey, SMTP_PASSWORD_SLOT);
  }
  // A user and a password come together or not at all.
  if ((user === null) !== (stored === null)) return INVALID;

  await upsert(db, actorId, 'smtp', { host, port, user, password: stored, from }, now);
  // Never the host's credentials: who, and whether a password is set.
  log('settings', 'smtp saved', { by: shortId(actorId), passwordSet: stored !== null });
  return OK;
}

export async function removeSmtp(
  db: ServerDatabase,
  actorId: string | null,
  source: SettingsSource = env(),
): Promise<SettingsWriteResult> {
  if (resolveSettings(source, []).smtp.source === 'env') return LOCKED;
  await db.delete(serverSettings).where(eq(serverSettings.key, 'smtp'));
  log('settings', 'smtp removed', { by: shortId(actorId) });
  return OK;
}
