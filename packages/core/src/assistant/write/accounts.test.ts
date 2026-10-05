import { describe, expect, it } from 'vitest';
import type { Account } from '../../entities';
import { resolveAccountInput } from './accounts';

const card: Account = {
  id: 'acc-card',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: 'hlc-card',
  deletedAt: null,
  name: 'Visa',
  type: 'credit_card',
  institution: 'Banca',
  openingBalance: -5000,
  includeInSpendable: false,
  colorIndex: 7,
  icon: 'credit-card',
  creditCloseDay: 20,
  creditChargeDay: 5,
  creditPaymentAccountId: 'acc-main',
  archivedAt: null,
  sortOrder: 2,
};

describe('resolveAccountInput', () => {
  it('keeps the stored balance (null buffer) and every field not given', () => {
    const result = resolveAccountInput(
      { id: 'acc-card', updatedAt: 'hlc-card', name: 'Amex' },
      card,
      2,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'acc-card',
        name: 'Amex',
        institution: 'Banca',
        type: 'credit_card',
        buffer: null,
        includeInSpendable: false,
        colorIndex: 7,
        icon: 'credit-card',
        creditCloseDay: 20,
        creditChargeDay: 5,
        creditPaymentAccountId: 'acc-main',
        expectedUpdatedAt: 'hlc-card',
      },
    });
  });

  it('turns a corrected balance into a signed buffer', () => {
    const result = resolveAccountInput(
      { id: 'acc-card', updatedAt: 'hlc-card', balanceMinor: -12050 },
      card,
      2,
    );
    expect(result.ok && result.value.buffer).toBe('-120.5');
  });
});
