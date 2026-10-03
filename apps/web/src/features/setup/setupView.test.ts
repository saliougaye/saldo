import { describe, expect, it } from 'vitest';
import { emailStatusKey, lockedNoteKey, setupModeChoices } from './setupView';

describe('setupModeChoices', () => {
  it('offers invite, open and closed, invite first and recommended', () => {
    expect(setupModeChoices('invite', false)).toEqual([
      {
        value: 'invite',
        labelKey: 'admin.settings.registration.invite',
        noteKey: 'admin.settings.registration.inviteNote',
        recommended: true,
      },
      {
        value: 'open',
        labelKey: 'admin.settings.registration.open',
        noteKey: 'admin.settings.registration.openNote',
        recommended: false,
      },
      {
        value: 'closed',
        labelKey: 'admin.settings.registration.closed',
        noteKey: 'setup.closedNote',
        recommended: false,
      },
    ]);
  });

  it('shows a locked first-user value, read-only, with its own label', () => {
    const choices = setupModeChoices('first-user', true);
    expect(choices.map((choice) => choice.value)).toEqual(['first-user']);
    expect(choices[0]?.labelKey).toBe('admin.settings.registration.firstUser');
  });

  it('a locked value the wizard offers shows the three, so the person sees what else exists', () => {
    expect(setupModeChoices('open', true).map((choice) => choice.value)).toEqual([
      'invite',
      'open',
      'closed',
    ]);
  });
});

describe('lockedNoteKey', () => {
  it('singular for one variable, plural for two, nothing for none', () => {
    expect(lockedNoteKey([])).toBeNull();
    expect(lockedNoteKey(['REGISTRATION'])).toBe('setup.lockedOne');
    expect(lockedNoteKey(['INSTANCE_NAME', 'REGISTRATION'])).toBe('setup.lockedMany');
  });
});

describe('emailStatusKey', () => {
  it('names the status line for each mail state', () => {
    expect(emailStatusKey('env')).toBe('setup.emailEnv');
    expect(emailStatusKey('configured')).toBe('setup.emailConfigured');
    expect(emailStatusKey('none')).toBe('setup.emailMissing');
  });
});
