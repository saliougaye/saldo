import { formatMoneyParts } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';
import { amountClass } from './AmountText';

describe('amountClass', () => {
  it('leaves a plain expense the text colour', () => {
    expect(amountClass(-1250, 'negative')).toBe('neutral');
  });

  it('marks income positive when the sign is shown', () => {
    expect(amountClass(1250, 'always')).toBe('positive');
  });

  it('marks a negative signed amount as spent', () => {
    expect(amountClass(-1250, 'always')).toBe('negative');
  });

  it('never marks anything when the sign is hidden, whatever the number', () => {
    expect(amountClass(-1250, 'never')).toBe('neutral');
    expect(amountClass(1250, 'never')).toBe('neutral');
  });

  it('agrees with what the formatter shows', () => {
    expect(formatMoneyParts(-1250, 'EUR', 'it', 'always').sign).not.toBe('');
  });
});
