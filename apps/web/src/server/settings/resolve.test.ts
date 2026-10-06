import { describe, expect, it } from 'vitest';
import type { SettingsEnvPart } from './resolve';
import { resolveSettings } from './resolve';

const noEnv: SettingsEnvPart = {
  registration: null,
  instanceName: null,
  rpName: 'Saldo',
  smtp: null,
  mcpEnabled: null,
};

const envSmtp = {
  host: 'smtp.env.example',
  port: 587,
  user: 'mailer',
  password: 'env-password',
  from: 'saldo@env.example',
};

const storedSmtp = {
  host: 'smtp.db.example',
  port: 2525,
  user: null,
  password: null,
  from: 'Saldo <saldo@db.example>',
};

describe('smtp', () => {
  it('is the whole environment group when SMTP_HOST is set, locked, never mixed with the row', () => {
    const resolved = resolveSettings({ ...noEnv, smtp: envSmtp }, [
      { key: 'smtp', value: storedSmtp },
    ]);
    expect(resolved.smtp).toEqual({ value: envSmtp, source: 'env', envVar: 'SMTP_HOST' });
  });

  it('reads a row that does not parse as not configured, and reports it', () => {
    const broken: unknown[] = [
      'localhost',
      null,
      {},
      { ...storedSmtp, host: '' },
      { ...storedSmtp, port: 0 },
      { ...storedSmtp, port: 70000 },
      { ...storedSmtp, port: '25' },
      { ...storedSmtp, from: undefined },
      { host: 'h', port: 25, from: 'a@b.c' },
    ];
    for (const value of broken) {
      const bad: string[] = [];
      const resolved = resolveSettings(noEnv, [{ key: 'smtp', value }], (key) => bad.push(key));
      expect(resolved.smtp).toEqual({ value: null, source: 'default', envVar: null });
      expect(bad).toEqual(['smtp']);
    }
  });
});
