import { describe, expect, it } from 'vitest';
import { listedZone } from './deviceZone';

const known = new Set(['Europe/Rome', 'Asia/Calcutta']);
const aliases = { 'Asia/Kolkata': 'Asia/Calcutta' };

describe('listedZone', () => {
  it('is the zone itself when the list holds it', () => {
    expect(listedZone('Europe/Rome', aliases, known)).toBe('Europe/Rome');
  });

  it('is the id the list holds for a name a browser reports', () => {
    expect(listedZone('Asia/Kolkata', aliases, known)).toBe('Asia/Calcutta');
  });

  it('is null for a zone the list does not hold, or none at all', () => {
    expect(listedZone('Mars/Olympus', aliases, known)).toBeNull();
    expect(listedZone(undefined, aliases, known)).toBeNull();
    expect(listedZone('', aliases, known)).toBeNull();
    expect(listedZone('constructor', aliases, known)).toBeNull();
  });
});
