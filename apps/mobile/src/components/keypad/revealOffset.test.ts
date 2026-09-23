import { revealOffset } from './revealOffset';

describe('revealOffset', () => {
  const viewport = { top: 100, bottom: 500 };

  it('scrolls nothing when the field already fits', () => {
    expect(revealOffset({ fieldTop: 200, fieldBottom: 300, ...viewport })).toBe(0);
  });

  it('scrolls down by what the keypad covers, plus a margin', () => {
    expect(revealOffset({ fieldTop: 420, fieldBottom: 540, ...viewport })).toBe(56);
  });

  it('scrolls up when the field is above the viewport', () => {
    expect(revealOffset({ fieldTop: 60, fieldBottom: 140, ...viewport })).toBe(-56);
  });

  it('prefers showing the top of a field taller than the viewport', () => {
    expect(revealOffset({ fieldTop: 90, fieldBottom: 900, ...viewport })).toBe(-26);
  });
});
