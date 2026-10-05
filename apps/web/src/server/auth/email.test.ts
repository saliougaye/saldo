import { describe, expect, it } from 'vitest';
import { isSyntheticEmail } from './email';

describe('the synthetic addresses of §9.1', () => {
  it('is recognised whatever its case', () => {
    expect(isSyntheticEmail('abc@passkey.saldo.invalid')).toBe(true);
    expect(isSyntheticEmail('ABC@Passkey.Saldo.Invalid')).toBe(true);
    expect(isSyntheticEmail('ada@example.com')).toBe(false);
    // Not ours: the domain has to be the whole of it, not a suffix somebody chose.
    expect(isSyntheticEmail('ada@evil-passkey.saldo.invalid')).toBe(false);
  });
});
