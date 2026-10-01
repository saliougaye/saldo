import { describe, expect, it } from 'vitest';
import type { Resolved } from '../../server/settings/resolve';
import type { SmtpView } from '../../server/settings/serverSettings';
import {
  lockedVariables,
  registrationChoices,
  type SettingsInput,
  settingsPanel,
  settingsRows,
} from './settingsView';

const smtpView: SmtpView = {
  host: 'smtp.example.com',
  port: 465,
  user: 'mailer',
  from: 'Saldo <saldo@example.com>',
  passwordSet: true,
  passwordReadable: true,
};

const fromDatabase = <T>(value: T): Resolved<T> => ({ value, source: 'database', envVar: null });
const fromEnv = <T>(value: T, envVar: string): Resolved<T> => ({ value, source: 'env', envVar });

const input: SettingsInput = {
  instanceName: fromDatabase('Casa Gaye'),
  registration: fromDatabase('invite'),
  smtp: fromDatabase(smtpView),
};

describe('settingsRows', () => {
  it('gives the three rows in order: name, registration, SMTP', () => {
    expect(settingsRows(input).map((row) => row.id)).toEqual(['name', 'registration', 'smtp']);
  });

  it('shows the name as a literal, with its subtitle', () => {
    expect(settingsRows(input)[0]).toMatchObject({
      labelKey: 'admin.settings.name.title',
      subtitle: { key: 'admin.settings.name.subtitle' },
      value: { text: 'Casa Gaye' },
      locked: false,
    });
  });

  it('shows the registration mode as its label', () => {
    expect(settingsRows(input)[1]).toMatchObject({
      labelKey: 'admin.settings.registration.title',
      subtitle: { key: 'admin.settings.registration.subtitle' },
      value: { key: 'admin.settings.registration.invite' },
    });
    expect(settingsRows({ ...input, registration: fromDatabase('first-user') })[1]?.value).toEqual({
      key: 'admin.settings.registration.firstUser',
    });
  });

  it('shows SMTP as host:port · user, with the ok mark, when it is configured', () => {
    expect(settingsRows(input)[2]).toMatchObject({
      labelKey: 'admin.settings.smtp.title',
      subtitle: { text: 'smtp.example.com:465 · mailer' },
      value: { key: 'admin.settings.smtp.configured' },
      ok: true,
    });
  });

  it('leaves the user out of the subtitle when there is none', () => {
    const smtp = fromDatabase({ ...smtpView, user: null, passwordSet: false });
    expect(settingsRows({ ...input, smtp })[2]?.subtitle).toEqual({ text: 'smtp.example.com:465' });
  });

  it('says SMTP is not configured, with no value and no mark', () => {
    const smtp: Resolved<SmtpView | null> = { value: null, source: 'default', envVar: null };
    expect(settingsRows({ ...input, smtp })[2]).toMatchObject({
      subtitle: { key: 'admin.settings.smtp.notConfigured' },
      value: null,
      ok: false,
      locked: false,
    });
  });

  it('puts «impostato dall’ambiente» under every row whose setting the environment sets', () => {
    const rows = settingsRows({
      instanceName: fromEnv('Da env', 'INSTANCE_NAME'),
      registration: fromEnv('closed', 'REGISTRATION'),
      smtp: fromEnv(smtpView, 'SMTP_HOST'),
    });
    for (const row of rows) {
      expect(row.locked).toBe(true);
      expect(row.subtitle).toEqual({ key: 'admin.settings.lockedSubtitle' });
    }
    expect(rows[0]?.value).toEqual({ text: 'Da env' });
    expect(rows[1]?.value).toEqual({ key: 'admin.settings.registration.closed' });
    expect(rows[2]).toMatchObject({ value: { key: 'admin.settings.smtp.configured' }, ok: true });
  });
});

describe('settingsPanel', () => {
  it.each(['name', 'registration', 'smtp'] as const)('opens %s', (id) => {
    expect(settingsPanel(id)).toBe(id);
  });

  it('takes the first of a repeated parameter', () => {
    expect(settingsPanel(['smtp', 'name'])).toBe('smtp');
  });

  it.each([undefined, '', 'Name', 'ai', 'name ', []])('opens nothing for %j', (raw) => {
    expect(settingsPanel(raw)).toBeNull();
  });
});

describe('registrationChoices', () => {
  it('lists the four modes in the mockup’s order, each with its one line', () => {
    expect(registrationChoices()).toEqual([
      {
        value: 'open',
        labelKey: 'admin.settings.registration.open',
        noteKey: 'admin.settings.registration.openNote',
      },
      {
        value: 'first-user',
        labelKey: 'admin.settings.registration.firstUser',
        noteKey: 'admin.settings.registration.firstUserNote',
      },
      {
        value: 'invite',
        labelKey: 'admin.settings.registration.invite',
        noteKey: 'admin.settings.registration.inviteNote',
      },
      {
        value: 'closed',
        labelKey: 'admin.settings.registration.closed',
        noteKey: 'admin.settings.registration.closedNote',
      },
    ]);
  });
});

describe('lockedVariables', () => {
  const locked: SettingsInput = {
    instanceName: fromEnv('Da env', 'INSTANCE_NAME'),
    registration: fromEnv('closed', 'REGISTRATION'),
    smtp: fromEnv(smtpView, 'SMTP_HOST'),
  };

  it('is empty for a setting the environment does not set', () => {
    for (const id of ['name', 'registration', 'smtp'] as const) {
      expect(lockedVariables(id, input)).toEqual([]);
    }
  });

  it('shows the value of REGISTRATION and of INSTANCE_NAME', () => {
    expect(lockedVariables('registration', locked)).toEqual([
      { name: 'REGISTRATION', value: 'closed' },
    ]);
    expect(lockedVariables('name', locked)).toEqual([{ name: 'INSTANCE_NAME', value: 'Da env' }]);
  });

  it('names the whole SMTP group and shows none of it, the password least of all', () => {
    const variables = lockedVariables('smtp', locked);
    expect(variables.map((variable) => variable.name)).toEqual([
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'SMTP_FROM',
    ]);
    expect(variables.every((variable) => variable.value === null)).toBe(true);
  });
});
