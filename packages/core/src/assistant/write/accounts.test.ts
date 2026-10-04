import { describe, expect, it } from 'vitest';
import type { Account } from '../../entities';
import {
  archiveAccountInput,
  archiveAccountTool,
  resolveAccountInput,
  saveAccountInput,
  saveAccountTool,
} from './accounts';

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

describe('saveAccountInput', () => {
  it('takes a negative balance but not a pocket', () => {
    expect(saveAccountInput.safeParse({ name: 'Visa', balanceMinor: -12000 }).success).toBe(true);
    expect(saveAccountInput.safeParse({ name: 'X', type: 'pocket' }).success).toBe(false);
  });
});

describe('resolveAccountInput', () => {
  it('creates from the form defaults, at zero when no balance is given', () => {
    expect(resolveAccountInput({ name: 'Cassa', type: 'cash' }, null, 2)).toEqual({
      ok: true,
      value: {
        id: null,
        name: 'Cassa',
        institution: '',
        type: 'cash',
        buffer: '',
        includeInSpendable: true,
        colorIndex: 0,
        icon: 'landmark',
        creditCloseDay: null,
        creditChargeDay: null,
        creditPaymentAccountId: null,
        expectedUpdatedAt: undefined,
      },
    });
  });

  it('needs a name to create', () => {
    expect(resolveAccountInput({ type: 'cash' }, null, 2)).toEqual({
      ok: false,
      message: expect.stringMatching(/name/),
    });
  });

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

describe('archive_account', () => {
  it('asks for an explicit action', () => {
    expect(archiveAccountInput.safeParse({ id: 'a', updatedAt: 'h' }).success).toBe(false);
    expect(
      archiveAccountInput.safeParse({ id: 'a', updatedAt: 'h', action: 'restore' }).success,
    ).toBe(true);
  });
  it('is destructive and idempotent; save_account is neither', () => {
    expect(archiveAccountTool.annotations).toMatchObject({
      destructiveHint: true,
      idempotentHint: true,
    });
    expect(saveAccountTool.annotations).toMatchObject({
      destructiveHint: false,
      idempotentHint: false,
    });
  });
});
