import { describe, expect, it } from 'vitest';
import { currencyConfirmBody } from './currencyConfirm';

const strings = { body: 'Reformatted, not converted.', scale: '{{before}} becomes {{after}}.' };

describe('currencyConfirmBody', () => {
  it('says the plain sentence between two currencies of the same scale', () => {
    expect(currencyConfirmBody({ current: 'EUR', pending: 'USD', locale: 'en', strings })).toBe(
      'Reformatted, not converted.',
    );
  });

  it('shows the same figure before and after when the decimals move (§5.1)', () => {
    const body = currencyConfirmBody({ current: 'EUR', pending: 'JPY', locale: 'en', strings });
    expect(body).toContain('1,842.60');
    expect(body).toContain('184,260');
    expect(body).toMatch(/becomes/);
  });

  it('does so in the other direction too', () => {
    const body = currencyConfirmBody({ current: 'JPY', pending: 'EUR', locale: 'it', strings });
    expect(body).toContain('184.260');
    expect(body).toContain('1.842,60');
  });
});
