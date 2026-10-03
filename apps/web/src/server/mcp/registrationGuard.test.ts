import { describe, expect, it } from 'vitest';
import { checkRegistration } from './registrationGuard';

const base = {
  client_name: 'Claude Code',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
};

describe('checkRegistration', () => {
  it('makes a loopback client public and native', () => {
    expect(
      checkRegistration({ ...base, redirect_uris: ['http://localhost:33418/callback'] }),
    ).toEqual({
      ok: true,
      body: {
        ...base,
        redirect_uris: ['http://localhost:33418/callback'],
        token_endpoint_auth_method: 'none',
        application_type: 'native',
      },
    });
  });

  it('accepts 127.0.0.1 on any port, and https elsewhere', () => {
    const checked = checkRegistration({
      ...base,
      redirect_uris: ['http://127.0.0.1:9/cb', 'https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
    });
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.body.application_type).toBe('native');
  });

  it('keeps a web client web when every redirect is https', () => {
    const checked = checkRegistration({
      ...base,
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    });
    expect(checked).toMatchObject({
      ok: true,
      body: { application_type: 'web', token_endpoint_auth_method: 'none' },
    });
  });

  it('forces native when a loopback redirect comes with application_type web', () => {
    const checked = checkRegistration({
      ...base,
      application_type: 'web',
      redirect_uris: ['http://localhost:1/cb'],
    });
    expect(checked).toMatchObject({ ok: true, body: { application_type: 'native' } });
  });

  it.each([
    'http://example.com/cb',
    'https://localhost/cb',
    'com.example.app:/cb',
    'https://claude.ai/cb#frag',
    'https://user:pw@claude.ai/cb',
    'not a url',
  ])('refuses the redirect %s', (uri) => {
    expect(checkRegistration({ ...base, redirect_uris: [uri] })).toMatchObject({
      ok: false,
      error: 'invalid_redirect_uri',
    });
  });

  it('refuses a registration with no redirect URI', () => {
    expect(checkRegistration({ ...base })).toMatchObject({
      ok: false,
      error: 'invalid_redirect_uri',
    });
    expect(checkRegistration({ ...base, redirect_uris: [] })).toMatchObject({ ok: false });
  });

  it.each(['client_secret_basic', 'client_secret_post', 'private_key_jwt'])(
    'refuses a confidential client (%s)',
    (method) => {
      expect(
        checkRegistration({
          ...base,
          redirect_uris: ['http://localhost:1/cb'],
          token_endpoint_auth_method: method,
        }),
      ).toMatchObject({ ok: false, error: 'invalid_client_metadata' });
    },
  );

  it('refuses a body that is not an object', () => {
    expect(checkRegistration(null)).toMatchObject({ ok: false, error: 'invalid_client_metadata' });
    expect(checkRegistration([])).toMatchObject({ ok: false, error: 'invalid_client_metadata' });
  });
});
