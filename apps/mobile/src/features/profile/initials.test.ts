import { initialsFrom } from './initials';

describe('initialsFrom', () => {
  it('takes one letter from each of the first two words', () => {
    expect(initialsFrom('Maria Carla')).toBe('MC');
    expect(initialsFrom('Ada Lovelace King')).toBe('AL');
  });

  it('takes the first two letters of a single name', () => {
    expect(initialsFrom('Ada')).toBe('AD');
  });

  it('falls back to S for Saldo when there is no name', () => {
    expect(initialsFrom(null)).toBe('S');
    expect(initialsFrom('')).toBe('S');
    expect(initialsFrom('   ')).toBe('S');
  });

  it('survives extra whitespace and reports upper case', () => {
    expect(initialsFrom('  maria   carla  ')).toBe('MC');
  });

  it('keeps a one-letter name to one letter rather than padding it', () => {
    expect(initialsFrom('A')).toBe('A');
  });

  it('handles an accented name without mangling it', () => {
    expect(initialsFrom('Émile Zola')).toBe('ÉZ');
  });
});
