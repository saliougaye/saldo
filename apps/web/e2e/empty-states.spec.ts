import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { listRow, money } from './support/ledger';
import { monthOf, previousMonth, readLedger, shiftDate } from './support/ledgerRows';
import { createMember } from './support/members';
import { literal, sectionOf } from './support/txPage';

const MAIN = 'Conto principale';

/** Archives the account that the default onboarding makes: the member then has none, as W11 expects. */
async function archiveMainAccount(page: Page, t: (key: string) => string): Promise<void> {
  await page.goto('/accounts');
  await listRow(page, MAIN).click();
  await page
    .getByRole('dialog', { name: MAIN })
    .getByRole('button', { name: t('accounts.archive') })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: t('common.archive'), exact: true })
    .click();
  await expect(page).toHaveURL(/\/accounts$/);
}

test('Home: a new member sees «Getting started», and an account moves it forward', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Nuovo',
    email: 'empty-home@e2e.test',
  });
  const { page } = member;
  await archiveMainAccount(page, t);

  await page.goto('/home');
  const start = page.getByRole('region', { name: t('home.startTitle') });
  await expect(start.getByRole('heading', { name: t('home.startTitle') })).toBeVisible();
  await expect(start).toContainText(t('home.startProgress', { done: 0, count: 4 }));
  const addAccount = start.getByRole('link', { name: t('accounts.newAccount') });
  await expect(addAccount).toHaveAttribute('href', '/accounts?new');

  await addAccount.click();
  const form = page.getByRole('dialog', { name: t('accounts.newAccount') });
  await form.getByLabel(t('accounts.name'), { exact: true }).fill('Contanti in tasca');
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(page).toHaveURL(/\/accounts\?a=/);

  await page.goto('/home');
  await expect(start).toContainText(t('home.startProgress', { done: 1, count: 4 }));
  const accounts = page.getByRole('region', { name: t('home.inAccounts') });
  await expect(accounts.getByText('Contanti in tasca')).toBeVisible();

  await member.context.close();
});

test('Transactions: with none, the quick add saves the first expense', async ({ browser, t }) => {
  const member = await createMember(browser, t, {
    name: 'Prima spesa',
    email: 'empty-quick-add@e2e.test',
  });
  const { page } = member;

  await page.goto('/transactions');
  const quick = page.locator('form').filter({
    has: page.getByRole('heading', { name: t('transactions.quickAddTitle') }),
  });
  await expect(quick.getByRole('link', { name: t('transactions.importCsv') })).toHaveAttribute(
    'href',
    '/profile/data',
  );

  await quick.getByLabel(t('txForm.amount')).fill('12,50');
  await quick.getByRole('button', { name: t('txForm.create') }).click();

  // The refresh swaps the form for the list, and the new row carries the amount.
  await expect(quick).toHaveCount(0);
  await expect(page.getByRole('main')).toContainText(money(1250));

  await member.context.close();
});

test('Transactions: a search with no result in the period lists the periods that match', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Ricerca',
    email: 'empty-no-results@e2e.test',
    seed: true,
  });
  const { page } = member;
  const ledger = await readLedger(member);
  const month = monthOf(ledger.today);

  // A description that the seed never dated inside this period, but dated in another one.
  const inMonth = new Set(
    ledger.transactions
      .filter((tx) => tx.date >= month.start && tx.date <= month.end)
      .map((tx) => tx.description.toLowerCase()),
  );
  const elsewhere = ledger.transactions
    .map((tx) => tx.description.toLowerCase())
    .find((description) => description.length > 2 && !inMonth.has(description));
  expect(elsewhere).toBeDefined();

  await page.goto(`/transactions?q=${encodeURIComponent(elsewhere ?? '')}`);
  const main = page.getByRole('main');
  await expect(
    main.getByText(literal(t('transactions.noResultsIn', { period: '' }).trim())),
  ).toBeVisible();
  const periods = main.locator('a[href*="q="]').filter({ hasText: /\d/ });
  await expect(periods.first()).toBeVisible();
  await expect(periods.first()).toHaveAttribute('href', /p=/);

  // The link opens a period that holds the rows, and the search stays on.
  await periods.first().click();
  await expect(page).toHaveURL(/q=/);
  await expect(main.getByText(literal(elsewhere ?? '')).first()).toBeVisible();

  await member.context.close();
});

test('Statistics: an empty period points to the nearest one with data', async ({ browser, t }) => {
  const member = await createMember(browser, t, {
    name: 'Periodo vuoto',
    email: 'empty-stats@e2e.test',
    seed: true,
  });
  const { page } = member;
  const ledger = await readLedger(member);

  const first = ledger.transactions.map((tx) => tx.date).sort()[0] ?? ledger.today;
  const before = previousMonth(monthOf(first));
  expect(shiftDate(before.end, 1)).toBe(monthOf(first).start);

  await page.goto(`/stats?p=${before.start}`);
  await expect(
    page.getByText(literal(t('stats.emptyPeriod', { period: '' }).trim())),
  ).toBeVisible();
  const link = page.getByRole('main').getByRole('link', {
    name: literal(t('stats.goToPeriod', { period: '' }).trim()),
  });
  await expect(link).toBeVisible();

  await link.click();
  await expect(page).not.toHaveURL(new RegExp(`p=${before.start}`));
  await expect(page.getByText(literal(t('stats.emptyPeriod', { period: '' }).trim()))).toHaveCount(
    0,
  );
  const split = sectionOf(page, t('stats.split'));
  await expect(split.locator('a[href*="c="]').first()).toBeVisible();

  await member.context.close();
});

test('Accounts: a member with none picks a type, and the form opens with it', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Senza conti',
    email: 'empty-accounts@e2e.test',
  });
  const { page } = member;
  await archiveMainAccount(page, t);

  await expect(page.getByRole('heading', { name: t('accounts.whichType') })).toBeVisible();
  const tiles = page.getByRole('main').locator('a[href*="?new&type="]');
  await expect(tiles).toHaveCount(6);
  const tile = tiles.nth(1);
  const label = (await tile.innerText()).trim();
  await tile.click();

  const form = page.getByRole('dialog', { name: t('accounts.newAccount') });
  await expect(form.getByRole('combobox', { name: t('accounts.type'), exact: true })).toContainText(
    label,
  );

  await member.context.close();
});

test('Budgets: a member with spending and no budget gets suggestions, each one a click from its form', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Senza budget',
    email: 'empty-budgets@e2e.test',
    seed: true,
  });
  const { page } = member;
  const ledger = await readLedger(member);
  expect(ledger.budgets.length).toBeGreaterThan(0);

  // The seed has budgets: delete them through the page.
  await page.goto('/profile/budgets');
  for (const budget of ledger.budgets) {
    await listRow(page, budget.name).click();
    await page
      .getByRole('dialog', { name: t('budgets.editBudget') })
      .getByRole('button', { name: t('budgets.deleteBudget') })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: t('common.delete'), exact: true })
      .click();
    await expect(page).toHaveURL(/\/profile\/budgets$/);
    await expect(listRow(page, budget.name)).toHaveCount(0);
  }

  const main = page.getByRole('main');
  await expect(main.getByText(t('budgets.suggestTitle'))).toBeVisible();
  const create = main.getByRole('link', { name: t('budgets.create'), exact: true }).first();
  const href = (await create.getAttribute('href')) ?? '';
  const categoryId = new URL(href, page.url()).searchParams.get('category');
  const category = ledger.categories.find((row) => row.id === categoryId);
  expect(category).toBeDefined();

  await create.click();
  const form = page.getByRole('dialog', { name: t('budgets.newBudget') });
  await expect(
    form.getByRole('button', { name: category?.name ?? '', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(form.getByRole('textbox', { name: t('budgets.amount') })).not.toHaveValue('');

  await member.context.close();
});
