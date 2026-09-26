import { describe, expect, it } from 'vitest';
import { groupTimeZones } from './timeZonePicker';

const ZONES = ['America/New_York', 'Asia/Tokyo', 'Europe/Rome', 'Europe/Zurich'];
const LABELS: Record<string, readonly string[]> = {
  'America/New_York': ['New York', 'Ora orientale USA'],
  'Asia/Tokyo': ['Tokyo', 'Ora del Giappone'],
  'Europe/Rome': ['Roma', 'Ora dell’Europa centrale'],
  'Europe/Zurich': ['Zurigo', 'Ora dell’Europa centrale'],
};
const labelsOf = (zone: string) => LABELS[zone] ?? [];

describe('groupTimeZones', () => {
  it('puts the saved zone on top and lists the rest once', () => {
    const groups = groupTimeZones({
      query: '',
      saved: 'Europe/Rome',
      device: 'Europe/Rome',
      zones: ZONES,
      labelsOf,
    });
    expect(groups.top).toEqual(['Europe/Rome']);
    expect(groups.all).toEqual(['America/New_York', 'Asia/Tokyo', 'Europe/Zurich']);
  });

  it('adds the phone’s zone under the saved one when they differ', () => {
    const groups = groupTimeZones({
      query: '',
      saved: 'Europe/Rome',
      device: 'America/New_York',
      zones: ZONES,
      labelsOf,
    });
    expect(groups.top).toEqual(['Europe/Rome', 'America/New_York']);
    expect(groups.all).toEqual(['Asia/Tokyo', 'Europe/Zurich']);
  });

  it('uses the phone’s zone when nothing is saved yet', () => {
    const groups = groupTimeZones({
      query: '',
      saved: null,
      device: 'Asia/Tokyo',
      zones: ZONES,
      labelsOf,
    });
    expect(groups.top).toEqual(['Asia/Tokyo']);
  });

  it('keeps a saved zone that is not in the list', () => {
    // A legacy name the phone reported (Asia/Kolkata where CLDR lists Asia/Calcutta).
    const groups = groupTimeZones({
      query: '',
      saved: 'Asia/Kolkata',
      device: 'Asia/Kolkata',
      zones: ZONES,
      labelsOf,
    });
    expect(groups.top).toEqual(['Asia/Kolkata']);
    expect(groups.all).toHaveLength(ZONES.length);
  });

  it('matches the city and the zone name, ignoring case and accents', () => {
    const search = (query: string) =>
      groupTimeZones({
        query,
        saved: 'Europe/Rome',
        device: 'Europe/Rome',
        zones: ZONES,
        labelsOf,
      });
    expect(search('zúrigo').all).toEqual(['Europe/Zurich']);
    expect(search('ZURIGO').top).toEqual([]);
    expect(search('europa centrale')).toEqual({ top: ['Europe/Rome'], all: ['Europe/Zurich'] });
    expect(search('tokyo').all).toEqual(['Asia/Tokyo']);
    expect(search('nowhere')).toEqual({ top: [], all: [] });
  });
});
