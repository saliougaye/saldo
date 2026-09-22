import { MASK, maskedMoney } from './mask';

describe('maskedMoney', () => {
  it('puts the symbol where the locale does', () => {
    expect(maskedMoney('EUR', 'it')).toBe(`${MASK} €`);
    expect(maskedMoney('USD', 'en')).toBe(`$${MASK}`);
  });
});
