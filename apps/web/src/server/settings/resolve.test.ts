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

describe('registration', () => {
  it('is the environment first, locked', () => {
    const resolved = resolveSettings({ ...noEnv, registration: 'invite' }, [
      { key: 'registration', value: 'open' },
    ]);
    expect(resolved.registration).toEqual({
      value: 'invite',
      source: 'env',
      envVar: 'REGISTRATION',
    });
  });

  it('is the stored row when the environment sets none', () => {
    expect(resolveSettings(noEnv, [{ key: 'registration', value: 'closed' }]).registration).toEqual(
      { value: 'closed', source: 'database', envVar: null },
    );
  });

  it('is first-user, today’s default, when neither says', () => {
    expect(resolveSettings(noEnv, []).registration).toEqual({
      value: 'first-user',
      source: 'default',
      envVar: null,
    });
  });

  it('reads a row that is not a mode as not set, and reports it', () => {
    const bad: string[] = [];
    const resolved = resolveSettings(noEnv, [{ key: 'registration', value: 'sometimes' }], (key) =>
      bad.push(key),
    );
    expect(resolved.registration.source).toBe('default');
    expect(bad).toEqual(['registration']);
  });
});

describe('instance name', () => {
  it('is INSTANCE_NAME first, locked', () => {
    expect(
      resolveSettings({ ...noEnv, instanceName: 'Da env' }, [
        { key: 'instanceName', value: 'Dal database' },
      ]).instanceName,
    ).toEqual({ value: 'Da env', source: 'env', envVar: 'INSTANCE_NAME' });
  });

  it('is the stored row when the environment sets none', () => {
    expect(
      resolveSettings(noEnv, [{ key: 'instanceName', value: 'Casa Gaye' }]).instanceName,
    ).toEqual({ value: 'Casa Gaye', source: 'database', envVar: null });
  });

  it('falls back to WEBAUTHN_RP_NAME, the name the sign-in page always showed', () => {
    expect(resolveSettings({ ...noEnv, rpName: 'Il mio Saldo' }, []).instanceName).toEqual({
      value: 'Il mio Saldo',
      source: 'default',
      envVar: null,
    });
  });

  it('reads an empty, non-string or over-long row as not set', () => {
    for (const value of ['', '   ', 7, null, 'x'.repeat(61)]) {
      const bad: string[] = [];
      const resolved = resolveSettings(noEnv, [{ key: 'instanceName', value }], (key) =>
        bad.push(key),
      );
      expect(resolved.instanceName.source).toBe('default');
      expect(bad).toEqual(['instanceName']);
    }
  });
});

describe('smtp', () => {
  it('is the whole environment group when SMTP_HOST is set, locked, never mixed with the row', () => {
    const resolved = resolveSettings({ ...noEnv, smtp: envSmtp }, [
      { key: 'smtp', value: storedSmtp },
    ]);
    expect(resolved.smtp).toEqual({ value: envSmtp, source: 'env', envVar: 'SMTP_HOST' });
  });

  it('is the stored row when the environment has no host', () => {
    expect(resolveSettings(noEnv, [{ key: 'smtp', value: storedSmtp }]).smtp).toEqual({
      value: storedSmtp,
      source: 'database',
      envVar: null,
    });
  });

  it('is not configured when neither says', () => {
    expect(resolveSettings(noEnv, []).smtp).toEqual({
      value: null,
      source: 'default',
      envVar: null,
    });
  });

  it('keeps the stored password as it is: an envelope, which this function never opens', () => {
    const row = { ...storedSmtp, user: 'mailer', password: 'v1:aaa:bbb:ccc' };
    expect(resolveSettings(noEnv, [{ key: 'smtp', value: row }]).smtp.value?.password).toBe(
      'v1:aaa:bbb:ccc',
    );
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

describe('rows', () => {
  it('ignores a key it does not know, and is independent per setting', () => {
    const bad: string[] = [];
    const resolved = resolveSettings(
      noEnv,
      [
        { key: 'somethingElse', value: 1 },
        { key: 'registration', value: 'nope' },
        { key: 'instanceName', value: 'Casa' },
      ],
      (key) => bad.push(key),
    );
    expect(bad).toEqual(['registration']);
    expect(resolved.registration.source).toBe('default');
    expect(resolved.instanceName.value).toBe('Casa');
  });
});

describe('mcp.enabled', () => {
  it('is the environment first, locked', () => {
    expect(
      resolveSettings({ ...noEnv, mcpEnabled: false }, [{ key: 'mcp.enabled', value: true }])
        .mcpEnabled,
    ).toEqual({ value: false, source: 'env', envVar: 'MCP_ENABLED' });
  });

  it('is the stored row when the environment sets none', () => {
    expect(resolveSettings(noEnv, [{ key: 'mcp.enabled', value: false }]).mcpEnabled).toEqual({
      value: false,
      source: 'database',
      envVar: null,
    });
  });

  it('is on when neither says', () => {
    expect(resolveSettings(noEnv, []).mcpEnabled).toEqual({
      value: true,
      source: 'default',
      envVar: null,
    });
  });

  it('reads a row that is not a boolean as not set, and reports it', () => {
    const bad: string[] = [];
    const resolved = resolveSettings(noEnv, [{ key: 'mcp.enabled', value: 'off' }], (key) =>
      bad.push(key),
    );
    expect(resolved.mcpEnabled).toEqual({ value: true, source: 'default', envVar: null });
    expect(bad).toEqual(['mcp.enabled']);
  });
});
