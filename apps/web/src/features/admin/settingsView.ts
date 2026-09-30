import type { RegistrationMode } from '../../server/env';
import type { Resolved } from '../../server/settings/resolve';
import type { SmtpView } from '../../server/settings/serverSettings';
import type { AdminMessage } from './message';

export const SETTINGS_PATH = '/admin/settings';

/** As `instanceNameRowSchema` accepts it. */
export const MAX_INSTANCE_NAME_LENGTH = 60;

/** The form's port when nothing is stored yet: STARTTLS submission. */
export const DEFAULT_SMTP_PORT = 587;

export type SettingsPanelId = 'name' | 'registration' | 'smtp';

/**
 * What the page hands over: the three resolved settings. The SMTP one is `smtpView`'s — the
 * configuration without its password — never `readServerSettings`'s raw value.
 */
export interface SettingsInput {
  instanceName: Resolved<string>;
  registration: Resolved<RegistrationMode>;
  smtp: Resolved<SmtpView | null>;
}

export interface SettingsRowView {
  id: SettingsPanelId;
  labelKey: string;
  subtitle: AdminMessage;
  /** The current value on the trailing side; `null` when there is nothing to say. */
  value: AdminMessage | null;
  /** The green dot before the value: the setting works. */
  ok: boolean;
  /** The environment sets it: the row says so and its panel cannot save. */
  locked: boolean;
}

const MODE_KEYS: Record<RegistrationMode, string> = {
  open: 'open',
  'first-user': 'firstUser',
  invite: 'invite',
  closed: 'closed',
};

const modeKey = (mode: RegistrationMode) => `admin.settings.registration.${MODE_KEYS[mode]}`;

const LOCKED_SUBTITLE: AdminMessage = { key: 'admin.settings.lockedSubtitle' };

/** Admin → Impostazioni (§17.1.7): the three rows, each opening its panel. */
export function settingsRows(input: SettingsInput): SettingsRowView[] {
  const { instanceName, registration, smtp } = input;
  const smtpSetting = smtp.value;
  const smtpSubtitle: AdminMessage =
    smtpSetting === null
      ? { key: 'admin.settings.smtp.notConfigured' }
      : {
          text:
            smtpSetting.user === null
              ? `${smtpSetting.host}:${smtpSetting.port}`
              : `${smtpSetting.host}:${smtpSetting.port} · ${smtpSetting.user}`,
        };
  return [
    {
      id: 'name',
      labelKey: 'admin.settings.name.title',
      subtitle:
        instanceName.source === 'env' ? LOCKED_SUBTITLE : { key: 'admin.settings.name.subtitle' },
      value: { text: instanceName.value },
      ok: false,
      locked: instanceName.source === 'env',
    },
    {
      id: 'registration',
      labelKey: 'admin.settings.registration.title',
      subtitle:
        registration.source === 'env'
          ? LOCKED_SUBTITLE
          : { key: 'admin.settings.registration.subtitle' },
      value: { key: modeKey(registration.value) },
      ok: false,
      locked: registration.source === 'env',
    },
    {
      id: 'smtp',
      labelKey: 'admin.settings.smtp.title',
      subtitle: smtp.source === 'env' ? LOCKED_SUBTITLE : smtpSubtitle,
      value: smtpSetting === null ? null : { key: 'admin.settings.smtp.configured' },
      ok: smtpSetting !== null,
      locked: smtp.source === 'env',
    },
  ];
}

type Param = string | string[] | undefined;

const PANELS: readonly SettingsPanelId[] = ['name', 'registration', 'smtp'];

/** Which panel `?edit=` opens; anything else opens nothing. */
export function settingsPanel(edit: Param): SettingsPanelId | null {
  const raw = Array.isArray(edit) ? edit[0] : edit;
  return PANELS.find((id) => id === raw) ?? null;
}

export interface RegistrationChoice {
  value: RegistrationMode;
  labelKey: string;
  noteKey: string;
}

/** The four modes as the mockup lists them, each with its line. */
export function registrationChoices(): RegistrationChoice[] {
  return (['open', 'first-user', 'invite', 'closed'] as const).map((value) => ({
    value,
    labelKey: modeKey(value),
    noteKey: `${modeKey(value)}Note`,
  }));
}

export interface LockedVariable {
  name: string;
  /** Shown for `REGISTRATION` and `INSTANCE_NAME`; `null` for the SMTP group — the password is one of them. */
  value: string | null;
}

const SMTP_VARIABLES = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];

/** The variables a locked panel names; empty when the environment does not set the setting. */
export function lockedVariables(id: SettingsPanelId, input: SettingsInput): LockedVariable[] {
  switch (id) {
    case 'name':
      return input.instanceName.source === 'env'
        ? [{ name: input.instanceName.envVar ?? 'INSTANCE_NAME', value: input.instanceName.value }]
        : [];
    case 'registration':
      return input.registration.source === 'env'
        ? [{ name: input.registration.envVar ?? 'REGISTRATION', value: input.registration.value }]
        : [];
    case 'smtp':
      // The whole group comes from the environment: name it all, show none of it.
      return input.smtp.source === 'env'
        ? SMTP_VARIABLES.map((name) => ({ name, value: null }))
        : [];
  }
}
