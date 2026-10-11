import { plural } from '@saldo/i18n';
import { expect, test } from './fixtures';
import {
  inRange,
  type LedgerTransaction,
  monthOf,
  previousMonth,
  readLedger,
} from './support/ledgerRows';
import { createMember } from './support/members';
import {
  appLocale,
  createExpense,
  dayHeading,
  homeFigure,
  moneyFormatter,
  sectionOf,
} from './support/txPage';

/** The settled day sections: «In arrivo» keeps its own, inside a closed `<details>`. */
const SETTLED_DAYS = 'section:not(details section)';

test.describe('seeded account', () => {
  test('a closed month groups its rows by day, newest first, with the day`s spend', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Giorni',
      email: 'tx-days@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const money = moneyFormatter(ledger, appLocale(locale));
    const month = previousMonth(monthOf(ledger.today));
    const rows = ledger.transactions.filter((tx) => inRange(tx.date, month));

    const byDay = new Map<string, LedgerTransaction[]>();
    for (const tx of rows) byDay.set(tx.date, [...(byDay.get(tx.date) ?? []), tx]);
    const days = [...byDay.keys()].sort().reverse();
    expect(days.length).toBeGreaterThan(10);

    await page.goto(`/transactions?p=${month.start}`);

    // One section per day, in order: this also proves that no day is missing or repeated.
    await expect(page.locator(SETTLED_DAYS).locator('h2')).toHaveText(
      days.map((date) => dayHeading(date, ledger.today, t, appLocale(locale))),
    );

    for (const date of days) {
      const dayRows = byDay.get(date) ?? [];
      const spend = dayRows
        .filter((tx) => tx.kind === 'expense' && !tx.excludeFromTotals)
        .reduce((total, tx) => total + tx.amount, 0);
      const section = sectionOf(page, dayHeading(date, ledger.today, t, appLocale(locale)));
      await expect(section.locator(':scope > div').first()).toContainText(money(spend));
      await expect(section.getByRole('link')).toHaveCount(dayRows.length);
    }

    // The header counts the rows of the period, transfers included.
    await expect(
      page.getByText(plural(t, appLocale(locale), 'transactions.periodCount', rows.length)),
    ).toBeVisible();
    await member.context.close();
  });

  test('«In arrivo» folds the rows dated ahead and opens on a click', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Arrivo',
      email: 'tx-upcoming@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    // The seed writes two one-off expenses dated ahead, inside this month: «In arrivo» stops at
    // the end of the period.
    const { end } = monthOf(ledger.today);
    test.skip(ledger.today === end, 'nothing is dated ahead inside the period on its last day');
    const ahead = ledger.transactions.filter((tx) => tx.date > ledger.today && tx.date <= end);
    expect(ahead.length).toBeGreaterThanOrEqual(2);

    await page.goto('/transactions');
    const disclosure = page.locator('details#upcoming');
    await expect(disclosure.locator('summary')).toContainText(t('transactions.upcoming'));
    await expect(disclosure.locator('summary')).toContainText(
      plural(t, lang, 'transactions.upcomingCount', ahead.length),
    );
    // Folded: nobody sees the rows, but the settled days are all there.
    for (const tx of ahead) {
      await expect(page.getByRole('link', { name: tx.description })).toBeHidden();
    }

    await disclosure.locator('summary').click();
    await expect(disclosure).toHaveAttribute('open', '');
    for (const tx of ahead) {
      const row = page.getByRole('link', { name: tx.description });
      await expect(row).toBeVisible();
      await expect(row).toContainText(money(-tx.amount));
    }

    await disclosure.locator('summary').click();
    await expect(disclosure).not.toHaveAttribute('open', '');
    await member.context.close();
  });

  test('filter chips narrow the list and clear again', async ({ browser, t, locale }) => {
    const member = await createMember(browser, t, {
      name: 'Filtri',
      email: 'tx-filters@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const month = previousMonth(monthOf(ledger.today));
    const rows = ledger.transactions.filter((tx) => inRange(tx.date, month));
    const expenses = rows.filter((tx) => tx.kind === 'expense');
    const transfers = rows.filter((tx) => tx.kind === 'transfer');
    const list = page.locator(`${SETTLED_DAYS} a`);

    await page.goto(`/transactions?p=${month.start}`);
    await expect(list).toHaveCount(rows.length);

    // «Solo uscite» drops income and transfers, and says how many transfers it hides.
    const onlyExpenses = page.getByRole('link', { name: t('transactions.onlyExpenses') });
    await onlyExpenses.click();
    await expect(onlyExpenses).toHaveAttribute('aria-current', 'true');
    await expect(list).toHaveCount(expenses.length);
    await expect(
      page.getByText(plural(t, lang, 'transactions.transfersHidden', transfers.length)),
    ).toBeVisible();

    // The chip is a switch: the same click clears it.
    await onlyExpenses.click();
    await expect(onlyExpenses).not.toHaveAttribute('aria-current', 'true');
    await expect(list).toHaveCount(rows.length);

    // A category covers its children: «Spesa» holds the supermarket and the bakery.
    const groceries = ledger.categories.find(
      (category) => category.id === 'seed-category-groceries',
    );
    const family = new Set(
      ledger.categories
        .filter((category) => category.parentId === groceries?.id || category.id === groceries?.id)
        .map((category) => category.id),
    );
    const grocery = rows.filter((tx) => tx.categoryId !== null && family.has(tx.categoryId));
    expect(grocery.length).toBeGreaterThan(0);
    await page.getByRole('button', { name: t('transactions.category') }).click();
    await page.getByRole('menuitem', { name: groceries?.name ?? '', exact: true }).click();
    await expect(page.getByRole('button', { name: groceries?.name ?? '' })).toBeVisible();
    await expect(list).toHaveCount(grocery.length);

    // Choosing it again clears it.
    await page.getByRole('button', { name: groceries?.name ?? '' }).click();
    await page.getByRole('menuitem', { name: groceries?.name ?? '', exact: true }).click();
    await expect(page.getByRole('button', { name: t('transactions.category') })).toBeVisible();
    await expect(list).toHaveCount(rows.length);

    // A search with no match says so, and «Azzera filtri» brings the list back.
    await page.getByRole('searchbox', { name: t('common.search') }).fill('zzzz-nessuna-voce');
    await page.keyboard.press('Enter');
    await expect(page.getByText(t('transactions.noResults'))).toBeVisible();
    await page.getByRole('link', { name: t('transactions.resetFilters') }).click();
    await expect(list).toHaveCount(rows.length);

    // A search on a description keeps the rows that carry it.
    const search = 'esselunga';
    const hits = rows.filter((tx) => tx.description.toLowerCase().includes(search));
    expect(hits.length).toBeGreaterThan(0);
    await page.getByRole('searchbox', { name: t('common.search') }).fill(search);
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(hits.length);
    await member.context.close();
  });

  test('a row opens its detail in the panel, and the panel closes again', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Dettaglio',
      email: 'tx-detail@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const target = ledger.transactions.find((tx) => tx.description === 'Idraulico');
    if (target === undefined) throw new Error('the seed has no «Idraulico»');
    const category = ledger.categories.find((entry) => entry.id === target.categoryId);
    const account = ledger.accounts.find((entry) => entry.id === target.accountId);

    await page.goto(`/transactions?p=${target.date}`);
    await expect(page.getByRole('complementary')).toHaveCount(0);

    await page.getByRole('link', { name: 'Idraulico' }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]t=${target.id}`));
    const panel = page.getByRole('complementary', { name: 'Idraulico' });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(money(-target.amount));
    await expect(panel).toContainText(category?.name ?? '');
    await expect(panel).toContainText(account?.name ?? '');
    await expect(panel).toContainText(t('transactions.manual'));
    await expect(page.getByRole('link', { name: 'Idraulico' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    await panel.getByRole('link', { name: t('common.close') }).click();
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]t=/);

    // Esc closes it too.
    await page.getByRole('link', { name: 'Idraulico' }).click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary')).toHaveCount(0);
    await member.context.close();
  });
});

test.describe('own rows', () => {
  test('create an expense, edit it, delete it: the list and Home follow', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Scrittura',
      email: 'tx-crud@e2e.test',
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const money = moneyFormatter(ledger, appLocale(locale));
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(0));

    // Create.
    const id = await createExpense(page, t, {
      amount: '12,50',
      description: 'Pranzo di prova',
      category: t('seed.restaurants'),
    });
    const detail = page.getByRole('complementary', { name: 'Pranzo di prova' });
    await expect(detail).toContainText(money(-1250));
    const today = ledger.today;
    const day = sectionOf(page, dayHeading(today, today, t, appLocale(locale)));
    await expect(day.getByRole('link', { name: 'Pranzo di prova' })).toContainText(money(-1250));
    await expect(day.locator(':scope > div').first()).toContainText(money(1250));
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(1250));

    // Edit.
    await page.goto(`/transactions?t=${id}`);
    await page.getByRole('link', { name: t('common.edit'), exact: true }).click();
    const form = page.getByRole('complementary', { name: t('txForm.editTitle') });
    await form.getByLabel(t('txForm.amount')).fill('20');
    await form.getByLabel(t('txForm.descriptionExpense')).fill('Cena di prova');
    await form.getByRole('button', { name: t('txForm.save') }).click();
    const edited = page.getByRole('complementary', { name: 'Cena di prova' });
    await expect(edited).toContainText(money(-2000));
    await expect(page.getByRole('link', { name: 'Pranzo di prova' })).toHaveCount(0);
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(2000));

    // Delete.
    await page.goto(`/transactions?t=${id}`);
    await page.getByRole('button', { name: t('common.delete') }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(t('transactions.deleteTitle', { name: 'Cena di prova' }));
    await dialog.getByRole('button', { name: t('common.delete') }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]deleted=${id}`));
    // The shell has its own status element (the navigation bar's «Loading…»): find the toast by its text.
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: t('transactions.deleted', { name: 'Cena di prova' }) }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cena di prova' })).toHaveCount(0);
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(0));
    await member.context.close();
  });

  test('«Annulla» brings a deleted transaction back', async ({ browser, t, locale }) => {
    const member = await createMember(browser, t, {
      name: 'Annulla',
      email: 'tx-undo@e2e.test',
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const money = moneyFormatter(ledger, appLocale(locale));

    const id = await createExpense(page, t, {
      amount: '8',
      description: 'Caffè di prova',
      category: t('seed.restaurants'),
    });
    // «Oggi» names the day of a row dated today.
    await expect(
      sectionOf(page, dayHeading(ledger.today, ledger.today, t, appLocale(locale))).getByRole(
        'link',
        { name: 'Caffè di prova' },
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: t('common.delete') }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: t('common.delete') })
      .click();
    await expect(page).toHaveURL(new RegExp(`[?&]deleted=${id}`));
    await expect(page.getByRole('link', { name: 'Caffè di prova' })).toHaveCount(0);

    // The toast stays five seconds: «Annulla» writes the row back and selects it again.
    await page.getByRole('button', { name: t('common.undo') }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]t=${id}`));
    await expect(page.getByRole('complementary', { name: 'Caffè di prova' })).toContainText(
      money(-800),
    );
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(800));
    await member.context.close();
  });

  test('saving a transaction that moved since it was opened shows the conflict', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Conflitto',
      email: 'tx-conflict@e2e.test',
    });
    const first = member.page;
    const id = await createExpense(first, t, {
      amount: '30',
      description: 'Bolletta di prova',
      category: t('seed.utilities'),
    });

    // The same transaction, open in two tabs of the same session.
    const second = await member.context.newPage();
    await first.goto(`/transactions?t=${id}&edit`);
    await second.goto(`/transactions?t=${id}&edit`);
    const firstForm = first.getByRole('complementary', { name: t('txForm.editTitle') });
    const secondForm = second.getByRole('complementary', { name: t('txForm.editTitle') });
    await expect(firstForm).toBeVisible();
    await expect(secondForm).toBeVisible();

    await firstForm.getByLabel(t('txForm.descriptionExpense')).fill('Bolletta del primo');
    await firstForm.getByRole('button', { name: t('txForm.save') }).click();
    await expect(first.getByRole('complementary', { name: 'Bolletta del primo' })).toBeVisible();

    await secondForm.getByLabel(t('txForm.descriptionExpense')).fill('Bolletta del secondo');
    await secondForm.getByRole('button', { name: t('txForm.save') }).click();
    await expect(secondForm.getByRole('alert')).toContainText(t('web.form.error_conflict'));
    // The form stays open with the draft, and the first save is what the server holds.
    await expect(secondForm).toBeVisible();
    await second.goto(`/transactions?t=${id}`);
    await expect(second.getByRole('complementary', { name: 'Bolletta del primo' })).toBeVisible();
    await expect(second.getByRole('link', { name: 'Bolletta del secondo' })).toHaveCount(0);
    await member.context.close();
  });
});
