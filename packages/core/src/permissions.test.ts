import { describe, expect, it } from 'vitest';
import {
  answerFromRequest,
  answerFromUnlock,
  mergeOsState,
  nextPending,
  type PermissionAnswer,
  type PermissionKey,
  permissionState,
} from './permissions';

const answers = (
  partial: Partial<Record<PermissionKey, PermissionAnswer>>,
): Record<PermissionKey, PermissionAnswer> => ({
  notifications: 'pending',
  camera: 'pending',
  appLock: 'pending',
  ...partial,
});

describe('permissionState', () => {
  it('reads a granted permission as granted, whatever canAskAgain says', () => {
    expect(permissionState({ granted: true, canAskAgain: false })).toBe('granted');
  });
  it('reads one the OS will still prompt for as askable', () => {
    expect(permissionState({ granted: false, canAskAgain: true })).toBe('askable');
  });
  it('reads one the OS will not prompt for again as denied', () => {
    expect(permissionState({ granted: false, canAskAgain: false })).toBe('denied');
  });
});

describe('answerFromRequest', () => {
  it('is granted or denied: a refused prompt is an answer even when Android could ask again', () => {
    expect(answerFromRequest({ granted: true, canAskAgain: true })).toBe('granted');
    expect(answerFromRequest({ granted: false, canAskAgain: true })).toBe('denied');
  });
});

describe('answerFromUnlock', () => {
  it('turns the lock on after a successful authentication', () => {
    expect(answerFromUnlock({ success: true })).toBe('granted');
  });
  it('leaves the row open when the user or the system cancelled', () => {
    for (const error of ['user_cancel', 'system_cancel', 'app_cancel']) {
      expect(answerFromUnlock({ success: false, error })).toBe('pending');
    }
  });
  it('reads any other failure as denied', () => {
    expect(answerFromUnlock({ success: false, error: 'passcode_not_set' })).toBe('denied');
  });
});

describe('mergeOsState', () => {
  it('fills a pending answer with what the OS already decided', () => {
    expect(mergeOsState('pending', 'granted')).toBe('granted');
    expect(mergeOsState('pending', 'denied')).toBe('denied');
    expect(mergeOsState('pending', 'askable')).toBe('pending');
  });
  it('upgrades any answer to granted — the user switched it on in the settings', () => {
    expect(mergeOsState('denied', 'granted')).toBe('granted');
    expect(mergeOsState('later', 'granted')).toBe('granted');
  });
  it('never reopens an answer the user gave', () => {
    expect(mergeOsState('denied', 'askable')).toBe('denied');
    expect(mergeOsState('later', 'askable')).toBe('later');
    expect(mergeOsState('later', 'denied')).toBe('later');
  });
});

describe('nextPending', () => {
  it('opens the first pending row, in the fixed order', () => {
    expect(nextPending(answers({}))).toBe('notifications');
    expect(nextPending(answers({ notifications: 'later' }))).toBe('camera');
    expect(nextPending(answers({ notifications: 'granted', camera: 'denied' }))).toBe('appLock');
  });
  it('opens nothing once every row is answered', () => {
    expect(
      nextPending(answers({ notifications: 'granted', camera: 'later', appLock: 'denied' })),
    ).toBeNull();
  });
});
