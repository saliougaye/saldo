import { matchesConfirmWord } from './confirmWord';

describe('matchesConfirmWord', () => {
  it('accepts the word whatever its case, with stray spaces', () => {
    expect(matchesConfirmWord('ELIMINA', 'ELIMINA')).toBe(true);
    expect(matchesConfirmWord(' elimina ', 'ELIMINA')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(matchesConfirmWord('', 'ELIMINA')).toBe(false);
    expect(matchesConfirmWord('ELIMIN', 'ELIMINA')).toBe(false);
    expect(matchesConfirmWord('ELIMINA TUTTO', 'ELIMINA')).toBe(false);
  });
});
