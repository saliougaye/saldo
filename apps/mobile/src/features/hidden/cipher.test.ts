import { digitCount, MASK, maskedMoney, scrambleDigits, settleDigits } from './cipher';

/** Deterministic: 0.0, 0.1, 0.2 … so the n-th digit drawn is n. */
function counter(): () => number {
  let n = 0;
  return () => (n++ % 10) / 10;
}

describe('scrambleDigits', () => {
  it('keeps every non-digit and the length', () => {
    expect(scrambleDigits('−1.284,50 €', counter())).toBe('−0.123,45 €');
    expect(scrambleDigits('+2.650,00 €', counter())).toBe('+0.123,45 €');
  });

  it('leaves a string without digits alone', () => {
    expect(scrambleDigits('•••• €', counter())).toBe('•••• €');
  });
});

describe('settleDigits', () => {
  it('settles from the right', () => {
    expect(settleDigits('1.284', 0, counter())).toBe('0.123');
    expect(settleDigits('1.284', 1, counter())).toBe('0.124');
    expect(settleDigits('1.284', 3, counter())).toBe('0.284');
    expect(settleDigits('1.284', 4, counter())).toBe('1.284');
    expect(settleDigits('1.284', 9, counter())).toBe('1.284');
  });
});

describe('digitCount', () => {
  it('counts only 0-9', () => {
    expect(digitCount('−1.284,50 €')).toBe(6);
    expect(digitCount('abc')).toBe(0);
  });
});

describe('maskedMoney', () => {
  it('puts the symbol where the locale does', () => {
    expect(maskedMoney('EUR', 'it')).toBe(`${MASK} €`);
    expect(maskedMoney('USD', 'en')).toBe(`$${MASK}`);
  });
});
