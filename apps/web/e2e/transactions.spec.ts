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
    // Folded: the disclosure hides its rows.
    for (const tx of ahead) {
      await expect(disclosure.getByRole('link', { name: tx.description })).toBeHidden();
    }

    await disclosure.locator('summary').click();
    await expect(disclosure).toHaveAttribute('open', '');
    for (const tx of ahead) {
      const row = disclosure.getByRole('link', { name: tx.description });
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

  test('the summary counts the period, and «More» holds the other filters', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Riepilogo',
      email: 'tx-summary@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const month = previousMonth(monthOf(ledger.today));
    const rows = ledger.transactions.filter((tx) => inRange(tx.date, month));
    const counted = rows.filter((tx) => tx.kind !== 'transfer' && !tx.excludeFromTotals);
    const spent = counted
      .filter((tx) => tx.kind === 'expense')
      .reduce((total, tx) => total + tx.amount, 0);
    const income = counted.filter((tx) => tx.kind === 'income');

    await page.goto(`/transactions?p=${month.start}`);

    // W5: a closed period has two cells, Expenses and Income; the figures are the period's.
    const summary = page.getByRole('region', { name: t('transactions.summaryLabel') });
    await expect(summary).toContainText(money(spent));
    await expect(summary).toContainText(plural(t, lang, 'transactions.periodCount', income.length));
    await expect(summary.getByText(t('home.upcoming'), { exact: true })).toHaveCount(0);

    // «More» holds «Income only»; its label then names the filter that is on.
    await page.getByRole('button', { name: t('transactions.moreFilters') }).click();
    await page.getByRole('menuitem', { name: t('transactions.onlyIncome') }).click();
    await expect(page.getByRole('button', { name: t('transactions.onlyIncome') })).toBeVisible();
    await expect(page.locator(`${SETTLED_DAYS} a`)).toHaveCount(
      rows.filter((tx) => tx.kind === 'income').length,
    );
    await expect(page.getByRole('link', { name: t('transactions.resetFilters') })).toBeVisible();
    await member.context.close();
  });

  test('a row opens its edit form in the dialog, and the dialog closes again', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Dettaglio',
      email: 'tx-detail@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const target = ledger.transactions.find((tx) => tx.description === 'Idraulico');
    if (target === undefined) throw new Error('the seed has no «Idraulico»');

    await page.goto(`/transactions?p=${target.date}`);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // W3: the row opens «Edit transaction» at once, with its fields filled.
    await page.getByRole('link', { name: 'Idraulico' }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]t=${target.id}`));
    const form = page.getByRole('dialog', { name: t('txForm.editTitle') });
    await expect(form).toBeVisible();
    await expect(form.getByLabel(t('txForm.descriptionExpense'))).toHaveValue('Idraulico');
    await expect(form.getByLabel(t('txForm.amount'))).not.toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await form.getByRole('link', { name: t('common.close') }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]t=/);

    // Esc closes it too.
    await page.getByRole('link', { name: 'Idraulico' }).click();
    await expect(form).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await member.context.close();
  });

  test('the dialog is in the centre of a wide screen and at the bottom of a narrow one', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Dialogo',
      email: 'tx-dialog@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const target = ledger.transactions.find((tx) => tx.description === 'Idraulico');
    if (target === undefined) throw new Error('the seed has no «Idraulico»');
    const form = page.getByRole('dialog', { name: t('txForm.editTitle') });
    const box = async () => {
      const value = await form.boundingBox();
      if (value === null) throw new Error('the dialog has no box');
      return value;
    };

    // W1: a form is 480px wide, in the centre of the screen. The poll waits for the entrance.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/transactions?t=${target.id}`);
    await expect(form).toBeVisible();
    await expect.poll(async () => Math.round((await box()).width)).toBe(480);
    const wide = await box();
    expect(Math.abs(wide.x + wide.width / 2 - 640)).toBeLessThanOrEqual(1);
    expect(Math.abs(wide.y + wide.height / 2 - 400)).toBeLessThanOrEqual(1);

    // W2: below 760px it is a sheet at the bottom of the screen, as wide as the screen.
    await page.setViewportSize({ width: 390, height: 800 });
    await expect
      .poll(async () => {
        const narrow = await box();
        return Math.round(narrow.y + narrow.height);
      })
      .toBe(800);
    expect(Math.round((await box()).width)).toBe(390);
    await member.context.close();
  });

  test('↑ ↓ walk the rows and ↵ opens the row with the focus', async ({ browser, t }) => {
    const member = await createMember(browser, t, {
      name: 'Tasti',
      email: 'tx-keys@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    // A closed month: no «In arrivo», so every row in the DOM is on screen.
    const month = previousMonth(monthOf(ledger.today));
    await page.goto(`/transactions?p=${month.start}`);
    const rows = page.locator('#content [data-select-id]');
    await expect(rows.nth(1)).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(rows.first()).toBeFocused();

    const id = await rows.first().getAttribute('data-select-id');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`[?&]t=${id}`));
    await expect(page.getByRole('dialog', { name: t('txForm.editTitle') })).toBeVisible();
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

    // Create: Save closes the dialog, and the row is in the list.
    const id = await createExpense(page, t, {
      amount: '12,50',
      description: 'Pranzo di prova',
      category: t('seed.restaurants'),
    });
    const today = ledger.today;
    const day = sectionOf(page, dayHeading(today, today, t, appLocale(locale)));
    await expect(day.getByRole('link', { name: 'Pranzo di prova' })).toContainText(money(-1250));
    await expect(day.locator(':scope > div').first()).toContainText(money(1250));
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(1250));

    // Edit: `?t=` opens the form at once (W3); Save closes it.
    await page.goto(`/transactions?t=${id}`);
    const form = page.getByRole('dialog', { name: t('txForm.editTitle') });
    await form.getByLabel(t('txForm.amount')).fill('20');
    await form.getByLabel(t('txForm.descriptionExpense')).fill('Cena di prova');
    await form.getByRole('button', { name: t('txForm.save') }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Cena di prova' })).toContainText(money(-2000));
    await expect(page.getByRole('link', { name: 'Pranzo di prova' })).toHaveCount(0);
    await page.goto('/home');
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(2000));

    // Delete: no question. The dialog closes and the toast offers «Undo».
    await page.goto(`/transactions?t=${id}`);
    await form.getByRole('button', { name: t('common.delete'), exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`[?&]deleted=${id}`));
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
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

    await page.getByRole('link', { name: 'Caffè di prova' }).click();
    await page
      .getByRole('dialog', { name: t('txForm.editTitle') })
      .getByRole('button', { name: t('common.delete'), exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`[?&]deleted=${id}`));
    await expect(page.getByRole('link', { name: 'Caffè di prova' })).toHaveCount(0);

    // The toast stays five seconds: «Undo» writes the row back into the list.
    await page.getByRole('button', { name: t('common.undo') }).click();
    await expect(page).not.toHaveURL(/[?&]deleted=/);
    await expect(page.getByRole('link', { name: 'Caffè di prova' })).toContainText(money(-800));
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
    const firstForm = first.getByRole('dialog', { name: t('txForm.editTitle') });
    const secondForm = second.getByRole('dialog', { name: t('txForm.editTitle') });
    await expect(firstForm).toBeVisible();
    await expect(secondForm).toBeVisible();

    await firstForm.getByLabel(t('txForm.descriptionExpense')).fill('Bolletta del primo');
    await firstForm.getByRole('button', { name: t('txForm.save') }).click();
    await expect(first.getByRole('link', { name: 'Bolletta del primo' })).toBeVisible();

    await secondForm.getByLabel(t('txForm.descriptionExpense')).fill('Bolletta del secondo');
    await secondForm.getByRole('button', { name: t('txForm.save') }).click();
    await expect(secondForm.getByRole('alert')).toContainText(t('web.form.error_conflict'));
    // The form stays open with the draft, and the first save is what the server holds.
    await expect(secondForm).toBeVisible();
    await second.goto(`/transactions?t=${id}`);
    await expect(
      second
        .getByRole('dialog', { name: t('txForm.editTitle') })
        .getByLabel(t('txForm.descriptionExpense')),
    ).toHaveValue('Bolletta del primo');
    await expect(second.getByRole('link', { name: 'Bolletta del secondo' })).toHaveCount(0);
    await member.context.close();
  });
});
