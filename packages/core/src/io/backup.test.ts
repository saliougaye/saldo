import { describe, expect, it } from 'vitest';
import { type BackupData, buildBackup, readBackup } from './backup';

const settings = {
  id: 'settings' as const,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '000000000000001-0000-dev',
  deletedAt: null,
  periodKind: 'cycle' as const,
  cycleStartDay: 27,
  currency: 'EUR' as const,
  language: 'it' as const,
  theme: 'system' as const,
  onboardingCompletedAt: '2026-09-01T10:00:00.000Z',
};

const account = {
  id: 'acc-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '000000000000001-0001-dev',
  deletedAt: null,
  name: 'Carta',
  type: 'checking' as const,
  institution: null,
  openingBalance: 10_000,
  includeInSpendable: true,
  colorIndex: 3,
  icon: 'card',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
};

const empty = {
  accounts: [],
  categories: [],
  tags: [],
  transactions: [],
  recurrences: [],
  budgets: [],
  attachments: [],
};

const data = (overrides: Partial<BackupData> = {}): BackupData => ({
  settings,
  ...empty,
  ...overrides,
});

const stamp = { exportedAt: '2026-09-11T08:00:00.000Z', appVersion: '0.1.0' };

describe('readBackup', () => {
  it('refuses a newer format version by name, without listing every row', () => {
    const newer = JSON.stringify({
      ...buildBackup({ ...stamp, data: data() }),
      version: 2,
      data: { whatever: true },
    });
    const result = readBackup(newer);
    expect(result).toMatchObject({ ok: false, reason: 'version' });
    if (!result.ok) expect(result.errors).toHaveLength(0);
  });

  it('reports which rows are invalid rather than dropping them', () => {
    const broken = JSON.stringify({
      ...buildBackup({ ...stamp, data: data({ accounts: [{ ...account, name: '' }] }) }),
    });
    const result = readBackup(broken);
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ entity: 'account', index: 0 });
    }
  });
});
