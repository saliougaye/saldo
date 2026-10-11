import { expect, test } from './fixtures';
import {
  addTransaction,
  escapeRegExp,
  fillTransaction,
  listRow,
  localToday,
  money,
  pickOption,
  saveTransaction,
} from './support/ledger';
import { createMember } from './support/members';

const MAIN = 'Conto principale';

test('accounts sit in their group, a goal sits under its account, and an account is archived and restored', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Chiara',
    email: 'chiara-accounts@e2e.test',
    seed: true,
  });
  const { page } = member;

  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: t('accounts.title'), level: 1 })).toBeVisible();

  // Groups: «Da spendere» holds the spendable accounts, «Risparmi e investimenti» the savings.
  const spending = page.locator('section').filter({
    has: page.getByRole('heading', { name: t('accounts.spending') }),
  });
  const savings = page.locator('section').filter({
    has: page.getByRole('heading', { name: t('accounts.savings') }),
  });
  await expect(spending.getByRole('link', { name: new RegExp(`^${MAIN}`) })).toBeVisible();
  await expect(spending.getByRole('link', { name: /^Contanti/ })).toBeVisible();
  await expect(spending.getByRole('link', { name: /^Risparmi/ })).toHaveCount(0);
  await expect(savings.getByRole('link', { name: /^Risparmi/ })).toBeVisible();

  // The two goals are pockets of «Risparmi»: a ring row each, then what is left free in the account.
  const giappone = savings.getByRole('link', { name: /^Viaggio in Giappone/ });
  const emergenza = savings.getByRole('link', { name: /^Fondo emergenza/ });
  await expect(giappone).toContainText(money(90000));
  await expect(emergenza).toContainText(money(180000));
  await expect(savings.getByText(t('goals.free'))).toBeVisible();
  await expect(spending.getByText('Viaggio in Giappone')).toHaveCount(0);

  // An account that holds goals cannot be archived until they are closed.
  await listRow(page, 'Risparmi').click();
  await expect(page.getByRole('complementary', { name: 'Risparmi' })).toBeVisible();
  await expect(page.getByText(t('goals.closeFirst'))).toBeVisible();
  await expect(page.getByRole('button', { name: t('accounts.archive') })).toHaveCount(0);

  // The panel opens in place, but «Modifica» loads the account's own form (`?a=ID&edit`), and its
  // ✕ goes back to the detail of that account, not to the list.
  const risparmi = page.getByRole('complementary', { name: 'Risparmi' });
  await risparmi.getByRole('link', { name: t('common.edit') }).click();
  await expect(page).toHaveURL(/\/accounts\?a=[^&]+&edit$/);
  const edit = page.getByRole('complementary', { name: t('accounts.editAccount') });
  await expect(edit.getByLabel(t('accounts.name'), { exact: true })).toHaveValue('Risparmi');
  await edit.getByRole('link', { name: t('common.close') }).click();
  await expect(risparmi).toBeVisible();
  await expect(page).toHaveURL(/\/accounts\?a=[^&]+$/);

  // Archive «Contanti»: a question first, then the row leaves the list.
  await listRow(page, 'Contanti').click();
  const detail = page.getByRole('complementary', { name: 'Contanti' });
  await expect(detail).toBeVisible();
  await detail.getByRole('button', { name: t('accounts.archive') }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('web.accounts.archiveBody', { name: 'Contanti' }));
  await dialog.getByRole('button', { name: t('common.cancel') }).click();
  await expect(dialog).toBeHidden();
  await expect(listRow(page, 'Contanti')).toBeVisible();

  await detail.getByRole('button', { name: t('accounts.archive') }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: t('common.archive'), exact: true })
    .click();
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(listRow(page, 'Contanti')).toHaveCount(0);

  // It waits in the archived list, and «Ripristina» brings it back.
  await listRow(page, t('profile.archivedAccounts')).click();
  const archived = page.getByRole('complementary', { name: t('web.accounts.archivedTitle') });
  await expect(archived.getByText('Contanti')).toBeVisible();
  await archived.getByRole('button', { name: t('accounts.restore') }).click();
  await expect(archived.getByText(t('accounts.archivedEmpty'))).toBeVisible();
  await page.getByRole('link', { name: t('common.close') }).click();
  await expect(listRow(page, 'Contanti')).toBeVisible();

  await member.context.close();
});

test('a credit card shows what it owes, its next charge and the statement once it is paid', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Davide',
    email: 'davide-card@e2e.test',
  });
  const { page } = member;

  // A close day that is not today, so the expense below belongs to the open statement.
  const todayOfMonth = Number(localToday().slice(8, 10));
  const closeDay = todayOfMonth === 10 ? 11 : 10;

  await page.goto('/accounts');
  await page.getByRole('link', { name: t('accounts.newAccount') }).click();
  const form = page.getByRole('complementary', { name: t('accounts.newAccount') });

  // The name is required.
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(form.getByRole('alert')).toContainText(t('accounts.missing_name'));

  await form.getByRole('textbox', { name: t('accounts.balance') }).fill('-200');
  await form.getByLabel(t('accounts.name'), { exact: true }).fill('Visa');
  await pickOption(page, t('accounts.type'), t('accountTypes.credit_card'));
  await pickOption(page, t('accounts.creditCloseDay'), String(closeDay));
  await pickOption(page, t('accounts.creditChargeDay'), '20');
  await pickOption(page, t('accounts.creditPaymentAccount'), MAIN);
  await form.getByRole('button', { name: t('common.save') }).click();

  // The saved card opens in its panel: it owes the 200 it started with.
  await expect(page).toHaveURL(/\/accounts\?a=/);
  const detail = page.getByRole('complementary', { name: 'Visa' });
  await expect(detail.getByText(t('accounts.toRepay'))).toBeVisible();
  await expect(detail).toContainText(money(20000));
  await expect(detail.getByText(t('accounts.accruedInCycle'))).toBeVisible();
  await expect(detail.getByText(t('accounts.nextCharge'))).toBeVisible();
  // The statement closed with the 200 owed, and the bank takes it on the charge day.
  await expect(detail.getByText(t('accounts.statementShort'))).toBeVisible();

  // A 50 expense on the card is accrued in the open cycle and adds to what the card owes.
  await addTransaction(page, t, {
    amount: '50',
    description: 'Cena',
    category: 'Ristoranti',
    account: 'Visa',
  });
  await page.goto('/accounts');
  await listRow(page, 'Visa').click();
  const owing = page.getByRole('complementary', { name: 'Visa' });
  await expect(owing).toContainText(money(25000));
  await expect(owing.getByText(t('accounts.accruedInCycle'))).toBeVisible();
  await expect(owing).toContainText(money(5000));

  // Paying the statement (200) from the main account settles it: «Saldato» replaces the figure.
  await addTransaction(page, t, {
    kind: 'transfer',
    amount: '200',
    account: MAIN,
    to: 'Visa',
  });
  await page.goto('/accounts');
  await listRow(page, 'Visa').click();
  const settled = page.getByRole('complementary', { name: 'Visa' });
  await expect(settled.getByText(t('accounts.paidShort'))).toBeVisible();
  await expect(settled).toContainText(money(5000));

  await member.context.close();
});

test('a goal goes from creation through a top up to its close, and a closed goal is restored', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Elena',
    email: 'elena-goal@e2e.test',
  });
  const { page } = member;
  const goal = 'Vacanza';

  await page.goto('/profile/goals');
  await expect(page.getByText(t('goals.emptyBody'))).toBeVisible();
  await page.getByRole('link', { name: t('goals.newGoal') }).click();
  const form = page.getByRole('complementary', { name: t('goals.newGoal') });

  // Each gap is named in the order of the form: name, target, deadline, account.
  await form.getByRole('button', { name: t('goals.create') }).click();
  await expect(form.getByRole('alert')).toContainText(t('goals.missing_name'));
  await form.getByLabel(t('goals.name'), { exact: true }).fill(goal);
  await form.getByRole('button', { name: t('goals.create') }).click();
  await expect(form.getByRole('alert')).toContainText(t('goals.missing_target'));
  await form.getByRole('textbox', { name: t('goals.target') }).fill('500');
  await form.getByLabel(t('goals.deadline'), { exact: true }).fill(localToday());
  await form.getByRole('button', { name: t('goals.create') }).click();
  await expect(form.getByRole('alert')).toContainText(t('goals.missing_deadline'));
  await form.getByLabel(t('goals.deadline'), { exact: true }).fill(localToday(365));
  await form.getByRole('button', { name: t('goals.create') }).click();
  await expect(form.getByRole('alert')).toContainText(t('goals.missing_parent'));
  await pickOption(page, t('goals.parent'), MAIN);
  await form.getByRole('button', { name: t('goals.create') }).click();

  // The goal is saved: it opens for editing and is listed with nothing set aside.
  await expect(page).toHaveURL(/\/profile\/goals\?g=/);
  await expect(listRow(page, goal)).toContainText(money(0));

  // In Conti it sits under its account, with nothing in it yet.
  await page.goto('/accounts');
  await listRow(page, goal).click();
  const panel = page.getByRole('complementary', { name: goal });
  await expect(panel.getByText(t('goals.noMovements'))).toBeVisible();

  // «Accantona» opens a transfer from the account to the goal; the amount is left to the person.
  await panel.getByRole('link', { name: t('goals.setAside') }).click();
  await fillTransaction(page, t, { kind: 'transfer', amount: '200' });
  await saveTransaction(page, t);
  // «Preleva» goes the other way.
  await page.goto('/accounts');
  await listRow(page, goal).click();
  await page
    .getByRole('complementary', { name: goal })
    .getByRole('link', { name: t('goals.withdraw') })
    .click();
  await fillTransaction(page, t, { kind: 'transfer', amount: '50' });
  await saveTransaction(page, t);

  // 200 − 50 is set aside: the goal's row and panel say so, the account keeps its 1.000 and 850 are free.
  await page.goto('/accounts');
  await expect(listRow(page, goal)).toContainText(money(15000));
  await expect(listRow(page, MAIN)).toContainText(money(100000));
  await expect(page.getByRole('main')).toContainText(
    new RegExp(`${escapeRegExp(t('goals.free'))}\\s*${escapeRegExp(money(85000))}`),
  );
  await listRow(page, goal).click();
  const funded = page.getByRole('complementary', { name: goal });
  await expect(funded).toContainText(money(15000));
  await expect(funded.getByText(t('goals.noMovements'))).toHaveCount(0);

  // Closing a funded goal asks what happened to the money; «Riporta» closes it and gives it back.
  await funded.getByRole('button', { name: t('goals.close') }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('goals.closeTitle'));
  await expect(dialog).toContainText(t('goals.closeBody', { amount: money(15000) }));
  await dialog.getByRole('button', { name: t('goals.returnTo', { name: MAIN }) }).click();
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(listRow(page, goal)).toHaveCount(0);
  await expect(listRow(page, MAIN)).toContainText(money(100000));
  await expect(page.getByText(t('goals.free'), { exact: true })).toHaveCount(0);

  // The closed goal is listed apart, and «Ripristina» opens it again.
  await page.goto('/profile/goals');
  const closed = page.locator('section').filter({
    has: page.getByRole('heading', { name: t('web.accounts.closedGoals') }),
  });
  await expect(closed.getByText(goal)).toBeVisible();
  await closed.getByRole('button', { name: t('accounts.restore') }).click();
  await expect(closed).toBeHidden();
  await expect(listRow(page, goal)).toBeVisible();

  await member.context.close();
});

test('closing a funded goal with «Registra la spesa» records the expense and closes the goal', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Fabio',
    email: 'fabio-goal@e2e.test',
  });
  const { page } = member;
  const goal = 'Bici';

  await page.goto('/profile/goals?new');
  const form = page.getByRole('complementary', { name: t('goals.newGoal') });
  await form.getByLabel(t('goals.name'), { exact: true }).fill(goal);
  await form.getByRole('textbox', { name: t('goals.target') }).fill('300');
  await pickOption(page, t('goals.parent'), MAIN);
  // «Già da parte» moves that much from the account into the goal at creation.
  await form.getByRole('textbox', { name: t('goals.alreadySaved') }).fill('120');
  await form.getByRole('button', { name: t('goals.create') }).click();
  await expect(page).toHaveURL(/\/profile\/goals\?g=/);

  await page.goto('/accounts');
  await expect(listRow(page, goal)).toContainText(money(12000));
  await listRow(page, goal).click();
  await page
    .getByRole('complementary', { name: goal })
    .getByRole('button', { name: t('goals.close') })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: t('goals.recordExpense') })
    .click();

  // The expense form opens from the goal, for everything it holds. Saving it closes the goal.
  await expect(page.getByRole('textbox', { name: t('txForm.amount') })).toHaveValue(/^120/);
  await fillTransaction(page, t, { amount: '120', category: 'Shopping' });
  await saveTransaction(page, t, /\/accounts$/);

  await page.goto('/accounts');
  await expect(listRow(page, goal)).toHaveCount(0);
  // The 120 left the account for good: 1.000 − 120.
  await expect(listRow(page, MAIN)).toContainText(money(88000));
  await page.goto('/profile/goals');
  await expect(page.getByText(goal)).toBeVisible();
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: t('web.accounts.closedGoals') }) })
      .getByText(goal),
  ).toBeVisible();

  await member.context.close();
});
