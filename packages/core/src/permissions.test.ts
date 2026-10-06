import { describe, expect, it } from 'vitest';
import { mergeOsState } from './permissions';

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
