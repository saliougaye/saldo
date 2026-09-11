import type { LedgerTx } from '@saldo/core';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { TagSpendCard } from './TagSpendCard';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const tags = [
  { id: 'tag-rome', name: 'Vacanza Roma' },
  { id: 'tag-move', name: 'Trasloco' },
];

jest.mock('../../db/hooks', () => ({
  useTags: () => tags,
}));

const RANGE = { start: '2026-03-27', end: '2026-04-26' };
const TODAY = '2026-04-18';

let sequence = 0;

function tx(overrides: Partial<LedgerTx> & Pick<LedgerTx, 'date' | 'amount'>): LedgerTx {
  sequence += 1;
  return {
    id: `t${sequence}`,
    kind: 'expense',
    accountId: 'acc-card',
    toAccountId: null,
    categoryId: 'cat-groceries',
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    description: '',
    ...overrides,
  };
}

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

beforeEach(() => {
  mockPush.mockClear();
});

function Host({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </ThemeProvider>
  );
}

function card(rows: readonly LedgerTx[]) {
  return (
    <Host>
      <TagSpendCard rows={rows} range={RANGE} today={TODAY} currency="EUR" locale="en" />
    </Host>
  );
}

describe('TagSpendCard', () => {
  const rows = () => [
    tx({ date: '2026-03-28', amount: 45_000, tagIds: ['tag-rome'] }),
    tx({ date: '2026-04-02', amount: 12_000, tagIds: ['tag-rome'] }),
    tx({ date: '2026-04-03', amount: 30_000, tagIds: ['tag-move'] }),
    tx({ date: '2026-04-04', amount: 1_500 }),
  ];

  it('names each tag and says how many transactions carry it', async () => {
    await render(card(rows()));
    expect(screen.getByText('Vacanza Roma')).toBeTruthy();
    expect(screen.getByText('2 transactions')).toBeTruthy();
    expect(screen.getByText('Trasloco')).toBeTruthy();
    expect(screen.getByText('1 transaction')).toBeTruthy();
  });

  it('says what it leaves out, so the ranking is not read as a share of the cycle', async () => {
    await render(card(rows()));
    expect(screen.getByText('1 transaction without a tag · €15.00')).toBeTruthy();
    expect(
      screen.getByText(
        'A transaction with several tags counts in each, so the sum runs past the cycle total.',
      ),
    ).toBeTruthy();
  });

  it('opens the tag view on a row, which is the screen that spans every date', async () => {
    await render(card(rows()));
    await userEvent.press(screen.getByText('Vacanza Roma'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tag/[id]', params: { id: 'tag-rome' } });
  });

  it('hands over to the full list', async () => {
    await render(card(rows()));
    await userEvent.press(screen.getByText('All tags'));
    expect(mockPush).toHaveBeenCalledWith('/settings/tags');
  });

  it('says so when nothing in the cycle carries a tag', async () => {
    await render(card([tx({ date: '2026-04-04', amount: 1_500 })]));
    expect(screen.getByText('No tags in this period')).toBeTruthy();
  });
});
