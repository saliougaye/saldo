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

describe('buildBackup', () => {
  it('stamps the envelope and carries the rows', () => {
    const backup = buildBackup({ ...stamp, data: data({ accounts: [account] }) });
    expect(backup.format).toBe('saldo-backup');
    expect(backup.version).toBe(1);
    expect(backup.app.version).toBe('0.1.0');
    expect(backup.data.accounts).toHaveLength(1);
  });
});

describe('readBackup', () => {
  it('accepts what buildBackup produced', () => {
    const result = readBackup(JSON.stringify(buildBackup({ ...stamp, data: data() })));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.data.settings.currency).toBe('EUR');
  });

  it('refuses a file that is not a backup at all', () => {
    expect(readBackup('not json')).toMatchObject({ ok: false, reason: 'unreadable' });
    expect(readBackup('{"format":"other","version":1}')).toMatchObject({
      ok: false,
      reason: 'not-a-backup',
    });
  });

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

  it('counts a row once however many of its fields are wrong', () => {
    const broken = JSON.stringify({
      ...buildBackup({
        ...stamp,
        data: data({ accounts: [{ ...account, name: '', colorIndex: 99, icon: '' }] }),
      }),
    });
    const result = readBackup(broken);
    if (!result.ok) expect(result.errors).toHaveLength(1);
  });

  it('names settings even though it is not a list', () => {
    const broken = JSON.stringify({
      ...buildBackup({ ...stamp, data: data() }),
      data: { ...data(), settings: { ...settings, currency: 'XXX' } },
    });
    const result = readBackup(broken);
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    if (!result.ok) expect(result.errors[0]?.entity).toBe('settings');
  });

  it('refuses a backup whose collections are missing', () => {
    const result = readBackup(
      JSON.stringify({ ...buildBackup({ ...stamp, data: data() }), data: { settings } }),
    );
    expect(result.ok).toBe(false);
  });
});
