import { z } from 'zod';
import { REGISTRATION_MODES, type RegistrationMode, type ServerEnv } from '../env';

/**
 * §17.1.8. Every setting the admin panel can change resolves the same way, in one pure function:
 * the environment first (and then the setting is **locked**), else the stored row, else a default.
 * Reading the rows and calling `env()` are the caller's job (`serverSettings.ts`), so this is tested
 * with no database.
 */
export type SettingSource = 'env' | 'database' | 'default';

export interface Resolved<T> {
  value: T;
  source: SettingSource;
  /** The variable that locks it when `source` is `env`; `null` otherwise. */
  envVar: string | null;
}

/**
 * What the `smtp` row holds, and what the environment's group is shaped as. `password` is the
 * `v1:` envelope when it came from the database and the plain value when it came from the
 * environment — this function never opens it (`secret.ts` does, and only for sending).
 */
export interface SmtpSetting {
  host: string;
  port: number;
  user: string | null;
  password: string | null;
  from: string;
}

export interface ResolvedSettings {
  registration: Resolved<RegistrationMode>;
  instanceName: Resolved<string>;
  smtp: Resolved<SmtpSetting | null>;
  /** §17.4.1: whether `/mcp`, its discovery documents and new authorizations are served. */
  mcpEnabled: Resolved<boolean>;
}

/** The part of `ServerEnv` the resolver looks at. */
export type SettingsEnvPart = Pick<
  ServerEnv,
  'registration' | 'instanceName' | 'rpName' | 'smtp' | 'mcpEnabled'
>;

export interface SettingRow {
  key: string;
  value: unknown;
}

export const DEFAULT_REGISTRATION: RegistrationMode = 'first-user';

export const registrationRowSchema = z.enum(REGISTRATION_MODES);
export const instanceNameRowSchema = z.string().trim().min(1).max(60);
export const smtpRowSchema = z.object({
  host: z.string().min(1).max(255).regex(/^\S+$/),
  port: z.number().int().min(1).max(65535),
  user: z.string().max(255).nullable(),
  password: z.string().nullable(),
  from: z.string().min(1),
});

/** The `server_settings` key of the MCP switch (§17.4.1). Its value is a JSON boolean. */
export const MCP_ENABLED_KEY = 'mcp.enabled';
export const DEFAULT_MCP_ENABLED = true;
export const mcpEnabledRowSchema = z.boolean();

/**
 * A row that no longer parses (somebody edited the value by hand) reads as **not set**, and
 * `onUnreadable` hears its key — never its contents, which may be a secret. It never breaks a page.
 */
function parseRow<T>(
  rows: readonly SettingRow[],
  key: string,
  schema: z.ZodType<T>,
  onUnreadable: (key: string) => void,
): T | null {
  const row = rows.find((candidate) => candidate.key === key);
  if (row === undefined) return null;
  const parsed = schema.safeParse(row.value);
  if (parsed.success) return parsed.data;
  onUnreadable(key);
  return null;
}

export function resolveSettings(
  envPart: SettingsEnvPart,
  rows: readonly SettingRow[],
  onUnreadable: (key: string) => void = () => {},
): ResolvedSettings {
  const registration: Resolved<RegistrationMode> = (() => {
    if (envPart.registration !== null) {
      return { value: envPart.registration, source: 'env', envVar: 'REGISTRATION' };
    }
    const stored = parseRow(rows, 'registration', registrationRowSchema, onUnreadable);
    if (stored !== null) return { value: stored, source: 'database', envVar: null };
    return { value: DEFAULT_REGISTRATION, source: 'default', envVar: null };
  })();

  const instanceName: Resolved<string> = (() => {
    if (envPart.instanceName !== null) {
      return { value: envPart.instanceName, source: 'env', envVar: 'INSTANCE_NAME' };
    }
    const stored = parseRow(rows, 'instanceName', instanceNameRowSchema, onUnreadable);
    if (stored !== null) return { value: stored, source: 'database', envVar: null };
    // What the sign-in page always showed, and still the passkey relying party's name.
    return { value: envPart.rpName, source: 'default', envVar: null };
  })();

  const smtp: Resolved<SmtpSetting | null> = (() => {
    // The whole group or none of it: a host in the environment never borrows from the row.
    if (envPart.smtp !== null) return { value: envPart.smtp, source: 'env', envVar: 'SMTP_HOST' };
    const stored = parseRow(rows, 'smtp', smtpRowSchema, onUnreadable);
    if (stored !== null) return { value: stored, source: 'database', envVar: null };
    return { value: null, source: 'default', envVar: null };
  })();

  const mcpEnabled: Resolved<boolean> = (() => {
    if (envPart.mcpEnabled !== null) {
      return { value: envPart.mcpEnabled, source: 'env', envVar: 'MCP_ENABLED' };
    }
    const stored = parseRow(rows, MCP_ENABLED_KEY, mcpEnabledRowSchema, onUnreadable);
    if (stored !== null) return { value: stored, source: 'database', envVar: null };
    return { value: DEFAULT_MCP_ENABLED, source: 'default', envVar: null };
  })();

  return { registration, instanceName, smtp, mcpEnabled };
}
