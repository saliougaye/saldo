import { userCount } from '../auth/policy';
import type { ServerDatabase } from '../db/types';
import { env, type RegistrationMode } from '../env';
import type { SettingSource } from '../settings/resolve';
import { readServerSettings, type SettingsSource, smtpView } from '../settings/serverSettings';

/** A setting as the wizard shows it: the value, where it came from, and whether the person may change it. */
export interface SetupSetting<T> {
  value: T;
  source: SettingSource;
  locked: boolean;
}

/** `env`: `SMTP_HOST` is set. `configured`: a stored configuration that still reads. `none`: nothing, or a password that no longer decrypts. */
export type SetupMailStatus = 'env' | 'configured' | 'none';

export interface SetupState {
  /** True while the instance has no account: the only condition under which `/setup` renders. */
  needed: boolean;
  instanceName: SetupSetting<string>;
  registration: SetupSetting<RegistrationMode>;
  /** The variables that lock step 2, in the order the note names them; empty when nothing is locked. */
  lockedVariables: string[];
  mail: SetupMailStatus;
}

/** 0.3h, decision 1: the gate is the user count. `/`, `/login` and `/register` send to `/setup` while this holds. */
export async function setupNeeded(db: ServerDatabase): Promise<boolean> {
  return (await userCount(db)) === 0;
}

/**
 * Everything `/setup` renders, in one read: the count, the three settings with their sources and
 * the mail status for the last step. Like the settings readers it takes the environment part last,
 * so a test states «the environment locks it» without touching `process.env`.
 */
export async function setupState(
  db: ServerDatabase,
  source: SettingsSource = env(),
): Promise<SetupState> {
  const [needed, settings, smtp] = await Promise.all([
    setupNeeded(db),
    readServerSettings(db, source),
    smtpView(db, source),
  ]);
  const lockedVariables: string[] = [];
  if (settings.instanceName.source === 'env') lockedVariables.push('INSTANCE_NAME');
  if (settings.registration.source === 'env') lockedVariables.push('REGISTRATION');
  return {
    needed,
    instanceName: {
      value: settings.instanceName.value,
      source: settings.instanceName.source,
      locked: settings.instanceName.source === 'env',
    },
    registration: {
      value: settings.registration.value,
      source: settings.registration.source,
      locked: settings.registration.source === 'env',
    },
    lockedVariables,
    mail: mailStatus(smtp),
  };
}

function mailStatus(smtp: Awaited<ReturnType<typeof smtpView>>): SetupMailStatus {
  if (smtp.value === null) return 'none';
  if (smtp.source === 'env') return 'env';
  return smtp.value.passwordReadable ? 'configured' : 'none';
}
