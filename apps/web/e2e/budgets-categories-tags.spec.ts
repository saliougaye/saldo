import { plural } from '@saldo/i18n';
import { expect, test } from './fixtures';
import { addTransaction, listRow, money, pickOption } from './support/ledger';
import { createMember } from './support/members';

const SHOPPING = 'Shopping';

test('a budget reads on track, over pace and over its limit as the spending grows, and it is deleted', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Giorgia',
    email: 'giorgia-budget@e2e.test',
  });
  const { page } = member;

  await page.goto('/profile/budgets');
  await expect(page.getByText(t('budgets.empty'), { exact: true })).toBeVisible();
  await page.getByRole('link', { name: t('budgets.newBudget') }).click();
  const form = page.getByRole('complementary', { name: t('budgets.newBudget') });

  // Both gaps are named at once, the category first.
  await form.getByRole('button', { name: t('budgets.create') }).click();
  await expect(form.getByRole('alert')).toContainText(t('budgets.missing_categories'));
  const tile = form.getByRole('button', { name: SHOPPING, exact: true });
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await form.getByRole('button', { name: t('budgets.create') }).click();
  await expect(form.getByRole('alert')).toContainText(t('budgets.missing_amount'));

  // A yearly budget: the pace is the share of the year gone, so the steps below hold on any day but the last.
  await form.getByRole('textbox', { name: t('budgets.amount') }).fill('100');
  await form.getByRole('radio', { name: t('budgets.periodYear') }).click();
  await form.getByRole('button', { name: t('budgets.create') }).click();
  await expect(page).toHaveURL(/\/profile\/budgets$/);

  // Nothing spent yet: on track, the whole limit left.
  const row = listRow(page, SHOPPING);
  await expect(row).toContainText(t('targets.inLine'));
  await expect(row).toContainText(t('targets.left', { amount: money(10000) }));

  // A category belongs to one budget: a second budget cannot take it.
  await page.getByRole('link', { name: t('budgets.newBudget') }).click();
  const second = page.getByRole('complementary', { name: t('budgets.newBudget') });
  await second.getByRole('button', { name: SHOPPING, exact: true }).click();
  await expect(second.getByRole('alert')).toContainText(
    t('web.budgets.error_taken', { name: SHOPPING }),
  );
  await expect(second.getByRole('button', { name: SHOPPING, exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // The whole limit spent, early in the year: the ratio is ahead of the pace, still under the limit.
  await addTransaction(page, t, {
    amount: '100',
    description: 'Scarpe',
    category: SHOPPING,
  });
  await page.goto('/profile/budgets');
  await expect(row).toContainText(t('targets.overPaceBy', { amount: '' }).trim());
  await expect(row).toContainText(t('targets.left', { amount: money(0) }));
  await expect(row).not.toContainText(t('targets.overLimitMeta'));

  // 20 more is over the limit, and the row says by how much.
  await addTransaction(page, t, { amount: '20', description: 'Cintura', category: SHOPPING });
  await page.goto('/profile/budgets');
  await expect(row).toContainText(t('targets.overLimitMeta'));
  await expect(row).toContainText(t('targets.overLimitBy', { amount: money(2000) }));

  // Deleting asks first; the transactions stay.
  await row.click();
  const edit = page.getByRole('complementary', { name: t('budgets.editBudget') });
  await edit.getByRole('button', { name: t('budgets.deleteBudget') }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('budgets.deleteTitle', { name: SHOPPING }));
  await dialog.getByRole('button', { name: t('common.delete'), exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/budgets$/);
  await expect(page.getByText(t('budgets.empty'), { exact: true })).toBeVisible();
  await page.goto('/transactions');
  await expect(page.getByText('Scarpe', { exact: true })).toBeVisible();

  await member.context.close();
});

/** The names of the category rows in the order the list shows them (a row's first line). */
async function categoryOrder(page: import('@playwright/test').Page): Promise<string[]> {
  const rows = await page.locator('a[href*="/profile/categories?c="]').allInnerTexts();
  return rows.map((text) => text.split('\n')[0]?.trim() ?? '');
}

test('archiving a category moves its transactions to another one, and the archived category is restored', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Hugo',
    email: 'hugo-categories@e2e.test',
  });
  const { page } = member;

  await addTransaction(page, t, { amount: '30', description: 'Palestra', category: 'Sport' });
  await page.goto('/profile/categories');
  await expect(listRow(page, 'Sport')).toContainText(plural(t, 'it', 'categories.uses', 1));
  await expect(listRow(page, 'Salute')).not.toContainText(plural(t, 'it', 'categories.uses', 1));

  await listRow(page, 'Sport').click();
  const form = page.getByRole('complementary', { name: t('categories.editCategory') });
  await form.getByRole('button', { name: t('categories.archive'), exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('categories.archiveTitle'));
  await expect(dialog).toContainText(plural(t, 'it', 'categories.archiveBody', 1));

  // With a target chosen the confirm button says that the transactions move too.
  await expect(dialog.getByRole('button', { name: t('categories.archive'), exact: true })).toBeVisible();
  await pickOption(page, t('categories.moveTo'), 'Salute');
  await dialog.getByRole('button', { name: t('categories.moveAndArchive') }).click();

  await expect(page).toHaveURL(/\/profile\/categories$/);
  await expect(listRow(page, 'Sport')).toHaveCount(0);
  await expect(listRow(page, 'Salute')).toContainText(plural(t, 'it', 'categories.uses', 1));

  // The transaction followed the move.
  await page.goto('/transactions');
  await expect(
    page.getByRole('link').filter({ has: page.getByText('Palestra', { exact: true }) }),
  ).toContainText('Salute');

  // A category nothing uses is archived with no question about a move.
  await page.goto('/profile/categories');
  await listRow(page, 'Formazione').click();
  await page
    .getByRole('complementary', { name: t('categories.editCategory') })
    .getByRole('button', { name: t('categories.archive'), exact: true })
    .click();
  const plain = page.getByRole('alertdialog');
  await expect(plain.getByRole('combobox')).toHaveCount(0);
  await plain.getByRole('button', { name: t('categories.archive'), exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/categories$/);
  await expect(listRow(page, 'Formazione')).toHaveCount(0);

  // Both wait in the archived list; «Ripristina» returns one of them.
  await listRow(page, t('categories.archivedSection')).click();
  const archived = page.getByRole('complementary', { name: t('categories.archived') });
  await expect(archived.getByText('Sport', { exact: true })).toBeVisible();
  await expect(archived.getByText('Formazione', { exact: true })).toBeVisible();
  await archived
    .getByText('Sport', { exact: true })
    .locator('xpath=ancestor::div[.//button][1]')
    .getByRole('button', { name: t('common.restore') })
    .click();
  await expect(archived.getByText('Sport', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: t('common.close') }).click();
  await expect(listRow(page, 'Sport')).toBeVisible();
  await expect(listRow(page, 'Formazione')).toHaveCount(0);

  await member.context.close();
});

test('a new category is listed under its parent and the arrows reorder it within its siblings', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Ilaria',
    email: 'ilaria-reorder@e2e.test',
  });
  const { page } = member;

  await page.goto('/profile/categories');
  await page.getByRole('link', { name: t('categories.newCategory') }).click();
  const form = page.getByRole('complementary', { name: t('categories.newCategory') });
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(form.getByRole('alert')).toContainText(t('categories.missing_name'));
  await form.getByLabel(t('categories.name'), { exact: true }).fill('Animali');
  await pickOption(page, t('categories.parent'), 'Casa');
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(page).toHaveURL(/\/profile\/categories$/);

  // A child follows its parent, after the children it already has.
  expect((await categoryOrder(page)).slice(0, 7)).toEqual([
    'Spesa',
    'Supermercato',
    'Panetteria',
    'Casa',
    'Affitto',
    'Manutenzione',
    'Animali',
  ]);

  // The first row of a group cannot go up, the last cannot go down.
  await expect(page.getByRole('button', { name: t('categories.moveUp', { name: 'Spesa' }) })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: t('categories.moveDown', { name: 'Animali' }) }),
  ).toBeDisabled();

  // A parent moves with its children.
  await page.getByRole('button', { name: t('categories.moveUp', { name: 'Casa' }) }).click();
  await expect
    .poll(async () => (await categoryOrder(page)).slice(0, 7))
    .toEqual(['Casa', 'Affitto', 'Manutenzione', 'Animali', 'Spesa', 'Supermercato', 'Panetteria']);
  await expect(page.getByRole('button', { name: t('categories.moveUp', { name: 'Casa' }) })).toBeDisabled();

  // A child moves among its siblings only.
  await page.getByRole('button', { name: t('categories.moveUp', { name: 'Animali' }) }).click();
  await expect
    .poll(async () => (await categoryOrder(page)).slice(0, 4))
    .toEqual(['Casa', 'Affitto', 'Animali', 'Manutenzione']);

  // The order is saved, not only drawn.
  await page.reload();
  expect((await categoryOrder(page)).slice(0, 7)).toEqual([
    'Casa',
    'Affitto',
    'Animali',
    'Manutenzione',
    'Spesa',
    'Supermercato',
    'Panetteria',
  ]);

  await member.context.close();
});

test('a tag is created, refused when it exists, and renamed', async ({ browser, t }) => {
  const member = await createMember(browser, t, {
    name: 'Jacopo',
    email: 'jacopo-tags@e2e.test',
  });
  const { page } = member;

  await page.goto('/profile/tags');
  await expect(page.getByText(t('tags.empty'), { exact: true })).toBeVisible();
  await page.getByRole('link', { name: t('tags.newTag') }).click();
  const form = page.getByRole('complementary', { name: t('tags.newTag') });
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(form.getByRole('alert')).toContainText(t('tags.missing_name'));
  await form.getByLabel(t('tags.name'), { exact: true }).fill('Viaggi');
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  await expect(listRow(page, 'Viaggi')).toContainText(plural(t, 'it', 'tags.uses', 0));

  // The same name twice is refused before anything is sent.
  await page.getByRole('link', { name: t('tags.newTag') }).click();
  const again = page.getByRole('complementary', { name: t('tags.newTag') });
  await again.getByLabel(t('tags.name'), { exact: true }).fill('Viaggi');
  await again.getByRole('button', { name: t('common.save') }).click();
  await expect(again.getByRole('alert')).toContainText(t('tags.missing_taken'));

  // Renaming keeps the tag and changes its name.
  await listRow(page, 'Viaggi').click();
  const edit = page.getByRole('complementary', { name: t('tags.editTag') });
  await edit.getByLabel(t('tags.name'), { exact: true }).fill('Trasferte');
  await edit.getByRole('button', { name: t('common.save') }).click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  await expect(listRow(page, 'Trasferte')).toBeVisible();
  await expect(listRow(page, 'Viaggi')).toHaveCount(0);

  await member.context.close();
});

/** The number a tag row says: «6 transazioni» → 6. */
async function usesOf(row: import('@playwright/test').Locator): Promise<number> {
  const text = await row.innerText();
  return Number(/\d+/.exec(text)?.[0]);
}

test('merging a tag moves its transactions into the other tag, which then carries both counts', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Katia',
    email: 'katia-merge@e2e.test',
    seed: true,
  });
  const { page } = member;

  await page.goto('/profile/tags');
  const famiglia = await usesOf(listRow(page, 'Famiglia'));
  const vacanze = await usesOf(listRow(page, 'Vacanze'));
  expect(famiglia).toBeGreaterThan(0);
  expect(vacanze).toBeGreaterThan(0);

  await listRow(page, 'Famiglia').click();
  const edit = page.getByRole('complementary', { name: t('tags.editTag') });
  await pickOption(page, t('tags.mergeInto'), 'Vacanze');

  // The question says what moves and that it cannot be undone; «Annulla» changes nothing.
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(
    plural(t, 'it', 'tags.mergeNote', famiglia, { name: 'Famiglia', target: 'Vacanze' }),
  );
  await dialog.getByRole('button', { name: t('common.cancel') }).click();
  await expect(dialog).toBeHidden();
  await expect(edit).toBeVisible();

  await pickOption(page, t('tags.mergeInto'), 'Vacanze');
  await page.getByRole('alertdialog').getByRole('button', { name: t('tags.merge'), exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  await expect(listRow(page, 'Famiglia')).toHaveCount(0);
  await expect(listRow(page, 'Vacanze')).toContainText(
    plural(t, 'it', 'tags.uses', famiglia + vacanze),
  );

  await member.context.close();
});

test('deleting a tag removes it from its transactions and leaves them in place', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Livia',
    email: 'livia-tag-delete@e2e.test',
  });
  const { page } = member;

  // A tag typed in the transaction form is created on the spot.
  await addTransaction(page, t, {
    amount: '40',
    description: 'Pranzo',
    category: 'Ristoranti',
    tag: 'Rimborso',
  });
  await page.goto('/transactions');
  await expect(page.getByText('#Rimborso', { exact: true })).toBeVisible();

  await page.goto('/profile/tags');
  await expect(listRow(page, 'Rimborso')).toContainText(plural(t, 'it', 'tags.uses', 1));
  await listRow(page, 'Rimborso').click();
  await page
    .getByRole('complementary', { name: t('tags.editTag') })
    .getByRole('button', { name: t('tags.delete') })
    .click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('tags.deleteTitle', { name: 'Rimborso' }));
  await expect(dialog).toContainText(plural(t, 'it', 'tags.deleteNote', 1));
  await dialog.getByRole('button', { name: t('common.delete'), exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  await expect(page.getByText(t('tags.empty'), { exact: true })).toBeVisible();

  await page.goto('/transactions');
  await expect(page.getByText('Pranzo', { exact: true })).toBeVisible();
  await expect(page.getByText('#Rimborso', { exact: true })).toHaveCount(0);

  await member.context.close();
});
