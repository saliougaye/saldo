import { serverSettings } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { RegistrationMode, ServerEnv } from '../env';
import { env } from '../env';
import { log } from '../log';
import {
  type Resolved,
  type ResolvedSettings,
  resolveSettings,
  type SettingSource,
  type SmtpSetting,
} from './resolve';
import { decryptSecret } from './secret';

/**
 * §17.1.8. The one place that reads `server_settings` and the environment together. The functions
 * take the environment part as an optional last argument — `env()` when omitted — so a test states
 * «env unset» by passing it, never by editing `process.env`.
 */
export type SettingsSource = Pick<
  ServerEnv,
  'registration' | 'instanceName' | 'rpName' | 'smtp' | 'settingsKey'
>;

/** The slot the SMTP password is sealed under (`secret.ts`): it fixes what the envelope decrypts as. */
export const SMTP_PASSWORD_SLOT = 'smtp.password';

/**
 * All three settings, resolved: one query, every row of a three-row table.
 *
 * **Internal.** `smtp.value.password` is the stored envelope (or the environment's plain value):
 * anything that serves a page or an action asks `smtpView` instead.
 */
export async function readServerSettings(
  db: ServerDatabase,
  source: SettingsSource = env(),
): Promise<ResolvedSettings> {
  const rows = await db.select().from(serverSettings);
  // Only the key is logged: a value may be a secret.
  return resolveSettings(source, rows, (key) => {
    log('settings', 'a stored setting does not parse; reading it as not set', { key });
  });
}

/**
 * The mode the gate applies. When `REGISTRATION` is set it is that value, **without** reading the
 * table: an instance configured the way it was before 0.3f-2 behaves exactly as it did, and does
 * not depend on the table for its gate. When it is not set the table is read, and a read that
 * fails rejects: the caller refuses the registration, it does not guess a mode.
 */
export async function registrationMode(
  db: ServerDatabase,
  source: SettingsSource = env(),
): Promise<RegistrationMode> {
  if (source.registration !== null) return source.registration;
  return (await readServerSettings(db, source)).registration.value;
}

export async function instanceName(
  db: ServerDatabase,
  source: SettingsSource = env(),
): Promise<string> {
  if (source.instanceName !== null) return source.instanceName;
  return (await readServerSettings(db, source)).instanceName.value;
}

/**
 * What pages and actions get (decision 5). No password, no envelope: only whether there is one and
 * whether it still reads with the current key.
 */
export interface SmtpView {
  host: string;
  port: number;
  user: string | null;
  from: string;
  passwordSet: boolean;
  /** False when the stored password no longer decrypts (the key changed): it has to be entered again. */
  passwordReadable: boolean;
}

function toView(setting: SmtpSetting, from: SettingSource, key: Buffer): SmtpView {
  const { password } = setting;
  return {
    host: setting.host,
    port: setting.port,
    user: setting.user,
    from: setting.from,
    passwordSet: password !== null,
    // The environment's password is plain text; only a stored one can fail to open.
    passwordReadable:
      password === null ||
      from === 'env' ||
      decryptSecret(password, key, SMTP_PASSWORD_SLOT) !== null,
  };
}

export async function smtpView(
  db: ServerDatabase,
  source: SettingsSource = env(),
): Promise<Resolved<SmtpView | null>> {
  const { smtp } = await readServerSettings(db, source);
  return {
    value: smtp.value === null ? null : toView(smtp.value, smtp.source, source.settingsKey),
    source: smtp.source,
    envVar: smtp.envVar,
  };
}

/**
 * The only function that opens the password. `null` when mail is not configured, or when the stored
 * password no longer decrypts: sending answers `notConfigured` rather than trying without it.
 */
export async function smtpForSending(
  db: ServerDatabase,
  source: SettingsSource = env(),
): Promise<SmtpSetting | null> {
  const { smtp } = await readServerSettings(db, source);
  if (smtp.value === null) return null;
  if (smtp.source === 'env' || smtp.value.password === null) return smtp.value;
  const password = decryptSecret(smtp.value.password, source.settingsKey, SMTP_PASSWORD_SLOT);
  return password === null ? null : { ...smtp.value, password };
}
