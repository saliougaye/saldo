import { describe, expect, it } from 'vitest';
import { checkRegistration } from './registrationGuard';

const base = {
  client_name: 'Claude Code',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
};

describe('checkRegistration', () => {
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
});
