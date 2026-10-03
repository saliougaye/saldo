import type { RegistrationMode } from '../../server/env';
import type { SetupMailStatus } from '../../server/setup/state';
import { SETUP_MODES, type SetupMode } from '../../server/setup/write';

/** The sub-path of `/admin/settings` the last step links to when mail is not configured. */
export const SMTP_SETTINGS_PATH = '/admin/settings?edit=smtp';

/** The invite's lifetime, in days: the panel's default, and all the wizard offers. */
export const FIRST_INVITE_TTL_DAYS = 7;

export interface SetupModeChoice {
  value: RegistrationMode;
  labelKey: string;
  noteKey: string;
  recommended: boolean;
}

const LABEL_KEY: Record<RegistrationMode, string> = {
  open: 'admin.settings.registration.open',
  'first-user': 'admin.settings.registration.firstUser',
  invite: 'admin.settings.registration.invite',
  closed: 'admin.settings.registration.closed',
};

/** The notes are the panel's, except `closed`: here it is «solo il tuo», because the wizard is about to create it. */
const NOTE_KEY: Record<RegistrationMode, string> = {
  open: 'admin.settings.registration.openNote',
  'first-user': 'admin.settings.registration.firstUserNote',
  invite: 'admin.settings.registration.inviteNote',
  closed: 'setup.closedNote',
};

function choice(value: RegistrationMode): SetupModeChoice {
  return {
    value,
    labelKey: LABEL_KEY[value],
    noteKey: NOTE_KEY[value],
    recommended: value === 'invite',
  };
}

/**
 * Step 2's list (decision 4): `invite`, `open`, `closed`, in that order. `first-user` is what the
 * wizard supersedes, so it appears only when the environment locks the value to it — then the list
 * is that one row, read-only, rather than three rows none of which is selected.
 */
export function setupModeChoices(value: RegistrationMode, locked: boolean): SetupModeChoice[] {
  if (locked && !isSetupMode(value)) return [choice(value)];
  return SETUP_MODES.map(choice);
}

export function isSetupMode(value: RegistrationMode): value is SetupMode {
  return (SETUP_MODES as readonly string[]).includes(value);
}

/** The line under the locked fields; `null` when nothing is locked. */
export function lockedNoteKey(
  variables: readonly string[],
): 'setup.lockedOne' | 'setup.lockedMany' | null {
  if (variables.length === 0) return null;
  return variables.length === 1 ? 'setup.lockedOne' : 'setup.lockedMany';
}

export function emailStatusKey(
  mail: SetupMailStatus,
): 'setup.emailEnv' | 'setup.emailConfigured' | 'setup.emailMissing' {
  switch (mail) {
    case 'env':
      return 'setup.emailEnv';
    case 'configured':
      return 'setup.emailConfigured';
    case 'none':
      return 'setup.emailMissing';
  }
}
