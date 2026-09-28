import { describe, expect, it } from 'vitest';
import { registerSteps, stepAfter, stepBefore, stepForErrorCode } from './registerSteps';

describe('registerSteps', () => {
  it('asks who you are and then for a passkey', () => {
    expect(registerSteps(false)).toEqual(['identity', 'passkey']);
  });

  it('puts the invite between them when the server asks for one', () => {
    expect(registerSteps(true)).toEqual(['identity', 'invite', 'passkey']);
  });
});

describe('moving between the steps', () => {
  const steps = registerSteps(true);

  it('goes forward and stops at the last', () => {
    expect(stepAfter(steps, 'identity')).toBe('invite');
    expect(stepAfter(steps, 'invite')).toBe('passkey');
    expect(stepAfter(steps, 'passkey')).toBeNull();
  });

  it('goes back and stops at the first', () => {
    expect(stepBefore(steps, 'passkey')).toBe('invite');
    expect(stepBefore(steps, 'identity')).toBeNull();
  });

  it('skips the invite when there is none', () => {
    expect(stepAfter(registerSteps(false), 'identity')).toBe('passkey');
    expect(stepBefore(registerSteps(false), 'passkey')).toBe('identity');
  });
});

describe('stepForErrorCode', () => {
  const withInvite = registerSteps(true);

  it('puts an email refusal in the step that asked for the email', () => {
    expect(stepForErrorCode('email_taken', withInvite)).toBe('identity');
    expect(stepForErrorCode('email_required', withInvite)).toBe('identity');
    expect(stepForErrorCode('display_name_required', withInvite)).toBe('identity');
  });

  it('puts an invite refusal in the invite step', () => {
    expect(stepForErrorCode('invalid_invite', withInvite)).toBe('invite');
  });

  it('puts an invite refusal in the first step when there is no invite step', () => {
    expect(stepForErrorCode('invalid_invite', registerSteps(false))).toBe('identity');
  });

  it('leaves everything else where the ceremony happens', () => {
    expect(stepForErrorCode('registration_closed', withInvite)).toBe('passkey');
    expect(stepForErrorCode('AUTH_CANCELLED', withInvite)).toBe('passkey');
    expect(stepForErrorCode('something new', withInvite)).toBe('passkey');
  });
});
