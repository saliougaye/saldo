import { archiveAccount } from './adminService';
import { closeGoal, createGoal } from './goalService';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

const NOW = '2026-09-24T10:00:00.000Z';
const TODAY = '2026-09-24';

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => NOW);
  const checking = repos.accounts.create({
    id: 'checking',
    name: 'Conto corrente',
    type: 'checking',
    institution: null,
    openingBalance: 700_000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  });
  return { db, repos, checking };
}

const input = {
  name: 'Macchina',
  icon: 'car',
  colorIndex: 5,
  parentAccountId: 'checking',
  goalTarget: 1_200_000,
  goalDeadline: '2027-06-30',
  alreadySaved: 500_000,
  today: TODAY,
  sortOrder: 1,
};

describe('createGoal', () => {
  it('opens an empty, unspendable pocket and moves what is already aside into it', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    expect(pocket).toMatchObject({
      type: 'pocket',
      openingBalance: 0,
      includeInSpendable: false,
      parentAccountId: 'checking',
      goalTarget: 1_200_000,
      goalDeadline: '2027-06-30',
      goalStartDate: TODAY,
    });
    const [transfer] = repos.transactions.list();
    expect(transfer).toMatchObject({
      kind: 'transfer',
      amount: 500_000,
      date: TODAY,
      accountId: 'checking',
      toAccountId: pocket.id,
      description: 'Macchina',
    });
  });

  it('writes no transfer when nothing is aside yet', () => {
    const { db, repos } = setup();
    createGoal(db, repos, { ...input, alreadySaved: 0 });
    expect(repos.transactions.list()).toEqual([]);
  });
});

describe('closeGoal', () => {
  it('returns what is left to the parent, then archives the pocket at zero', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    const back = repos.transactions.list().find((row) => row.accountId === pocket.id);
    expect(back).toMatchObject({
      kind: 'transfer',
      amount: 500_000,
      toAccountId: 'checking',
    });
    expect(repos.accounts.byId(pocket.id)?.archivedAt).toBe(NOW);
  });

  it('only archives a pocket that is already empty', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, { ...input, alreadySaved: 0 });
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    expect(repos.transactions.list()).toEqual([]);
    expect(repos.accounts.byId(pocket.id)?.archivedAt).toBe(NOW);
  });
});

describe('archiveAccount', () => {
  it('refuses a parent that still holds an open goal', () => {
    const { db, repos } = setup();
    createGoal(db, repos, input);
    expect(() => archiveAccount(repos, 'checking', NOW)).toThrow(/open goals/);
    expect(repos.accounts.byId('checking')?.archivedAt).toBeNull();
  });
});
