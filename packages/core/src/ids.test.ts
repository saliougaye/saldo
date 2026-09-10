import { describe, expect, it } from 'vitest';
import { newId, occurrenceId, SETTINGS_ID } from './ids';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  it('returns time-ordered UUIDv7 strings', () => {
    const first = newId();
    const second = newId();
    expect(first).toMatch(UUID_V7);
    expect(second).toMatch(UUID_V7);
    expect(first < second).toBe(true);
  });
});

describe('occurrenceId', () => {
  it('combines recurrence id and date deterministically', () => {
    expect(occurrenceId('rec-1', '2026-04-20')).toBe('rec-1:2026-04-20');
    expect(occurrenceId('rec-1', '2026-04-20')).toBe(occurrenceId('rec-1', '2026-04-20'));
  });
});

describe('SETTINGS_ID', () => {
  it('is the fixed singleton id', () => {
    expect(SETTINGS_ID).toBe('settings');
  });
});
