import { describe, expect, it } from 'vitest';
import type { Resolved } from '../../server/settings/resolve';
import type { SmtpView } from '../../server/settings/serverSettings';
import { lockedVariables, type SettingsInput } from './settingsView';

const smtpView: SmtpView = {
  host: 'smtp.example.com',
  port: 465,
  user: 'mailer',
  from: 'Saldo <saldo@example.com>',
  passwordSet: true,
  passwordReadable: true,
};

const fromEnv = <T>(value: T, envVar: string): Resolved<T> => ({ value, source: 'env', envVar });

describe('lockedVariables', () => {
  const locked: SettingsInput = {
    instanceName: fromEnv('Da env', 'INSTANCE_NAME'),
    registration: fromEnv('closed', 'REGISTRATION'),
    smtp: fromEnv(smtpView, 'SMTP_HOST'),
  };

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
