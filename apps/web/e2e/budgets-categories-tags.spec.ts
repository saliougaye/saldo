import type { Locator, Page } from '@playwright/test';
import { plural } from '@saldo/i18n';
import { expect, test } from './fixtures';
import { addTransaction, listRow, money, pickOption } from './support/ledger';
import { createMember } from './support/members';

const SHOPPING = 'Shopping';

// The yearly pace is 100 % only on the last day of the year, and the steps below need it under 100 %.
const lastDayOfYear = new Date().getMonth() === 11 && new Date().getDate() === 31;
test('a budget reads on track, over pace and over its limit as the spending grows, and it is deleted', async ({
  browser,
  t,
}) => {
  test.skip(lastDayOfYear, 'the yearly pace reaches the limit on 31 December');
  const member = await createMember(browser, t, {
    name: 'Giorgia',
    email: 'giorgia-budget@e2e.test',
  });
  const { page } = member;

  await page.goto('/profile/budgets');
  await expect(page.getByText(t('budgets.empty'), { exact: true })).toBeVisible();
  await page.getByRole('link', { name: t('budgets.newBudget') }).click();
  const form = page.getByRole('dialog', { name: t('budgets.newBudget') });

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

  // A category belongs to one budget: its tile is off in a second one.
  await page.getByRole('link', { name: t('budgets.newBudget') }).click();
  const second = page.getByRole('dialog', { name: t('budgets.newBudget') });
  await expect(second.getByRole('button', { name: SHOPPING, exact: true })).toBeDisabled();

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
  const edit = page.getByRole('dialog', { name: t('budgets.editBudget') });
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
async function categoryOrder(page: Page): Promise<string[]> {
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
  const form = page.getByRole('dialog', { name: t('categories.editCategory') });
  await form.getByRole('button', { name: t('categories.archive'), exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText(t('categories.archiveTitle'));
  await expect(dialog).toContainText(plural(t, 'it', 'categories.archiveBody', 1));

  // With a target chosen the confirm button says that the transactions move too.
  await expect(
    dialog.getByRole('button', { name: t('categories.archive'), exact: true }),
  ).toBeVisible();
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
    .getByRole('dialog', { name: t('categories.editCategory') })
    .getByRole('button', { name: t('categories.archive'), exact: true })
    .click();
  const plain = page.getByRole('alertdialog');
  await expect(plain.getByRole('combobox')).toHaveCount(0);
  await plain.getByRole('button', { name: t('categories.archive'), exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/categories$/);
  await expect(listRow(page, 'Formazione')).toHaveCount(0);

  // Both wait in the archived list; «Ripristina» returns one of them.
  await listRow(page, t('categories.archivedSection')).click();
  const archived = page.getByRole('dialog', { name: t('categories.archived') });
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
  const form = page.getByRole('dialog', { name: t('categories.newCategory') });
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
  await expect(
    page.getByRole('button', { name: t('categories.moveUp', { name: 'Spesa' }) }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: t('categories.moveDown', { name: 'Animali' }) }),
  ).toBeDisabled();

  // A parent moves with its children.
  await page.getByRole('button', { name: t('categories.moveUp', { name: 'Casa' }) }).click();
  await expect
    .poll(async () => (await categoryOrder(page)).slice(0, 7))
    .toEqual(['Casa', 'Affitto', 'Manutenzione', 'Animali', 'Spesa', 'Supermercato', 'Panetteria']);
  await expect(
    page.getByRole('button', { name: t('categories.moveUp', { name: 'Casa' }) }),
  ).toBeDisabled();

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
  const form = page.getByRole('dialog', { name: t('tags.newTag') });
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(form.getByRole('alert')).toContainText(t('tags.missing_name'));
  await form.getByLabel(t('tags.name'), { exact: true }).fill('Viaggi');
  await form.getByRole('button', { name: t('common.save') }).click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  await expect(listRow(page, 'Viaggi')).toContainText(plural(t, 'it', 'tags.uses', 0));

  // The same name twice is refused before anything is sent.
  await page.getByRole('link', { name: t('tags.newTag') }).click();
  const again = page.getByRole('dialog', { name: t('tags.newTag') });
  await again.getByLabel(t('tags.name'), { exact: true }).fill('Viaggi');
  await again.getByRole('button', { name: t('common.save') }).click();
  await expect(again.getByRole('alert')).toContainText(t('tags.missing_taken'));
  // D3: the panel is a dialog over the page; close it to reach the list.
  await again.getByRole('link', { name: t('common.close') }).click();
  await expect(again).toHaveCount(0);

  // Renaming keeps the tag and changes its name.
  await listRow(page, 'Viaggi').click();
  const edit = page.getByRole('dialog', { name: t('tags.editTag') });
  await edit.getByLabel(t('tags.name'), { exact: true }).fill('Trasferte');
  await edit.getByRole('button', { name: t('common.save') }).click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  await expect(listRow(page, 'Trasferte')).toBeVisible();
  await expect(listRow(page, 'Viaggi')).toHaveCount(0);

  await member.context.close();
});

/** The number a tag row says: «6 transazioni» → 6. */
async function usesOf(row: Locator): Promise<number> {
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
  const edit = page.getByRole('dialog', { name: t('tags.editTag') });
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
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: t('tags.merge'), exact: true })
    .click();
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
    .getByRole('dialog', { name: t('tags.editTag') })
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

/** The requests that ask the server for a page: RSC, and not a prefetch. A close in place sends none. */
function pageRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers.rsc === '1' && headers['next-router-prefetch'] !== '1') urls.push(request.url());
  });
  return urls;
}

// Regression: with `onlyChange` typed `S | null`, the close of `PanelSwitch` (state `null`) read as
// «a navigation». ✕, Esc and «Annulla» then asked the server for the page and lost the focus.
test('regression: a close in PanelSwitch is not a navigation, and the focus goes back to the row', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Marco',
    email: 'marco-tag-close@e2e.test',
    seed: true,
  });
  const { page } = member;

  await page.goto('/profile/tags');
  const row = listRow(page, 'Vacanze');
  const href = await row.getAttribute('href');
  if (href === null) throw new Error('the row has no link');
  const sent = pageRequests(page);
  const panel = page.getByRole('dialog', { name: t('tags.editTag') });
  const closes: [string, () => Promise<void>][] = [
    ['✕', () => panel.getByRole('link', { name: t('common.close') }).click()],
    ['Esc', () => page.keyboard.press('Escape')],
    ['Annulla', () => panel.getByRole('link', { name: t('common.cancel') }).click()],
  ];
  const closeAndCheck = async (name: string, close: () => Promise<void>) => {
    await expect(panel, name).toBeVisible();
    await close();
    await expect(panel, name).toBeHidden();
    await expect(page, name).toHaveURL(/\/profile\/tags$/);
    await expect(row, name).toBeFocused();
  };
  // A load of the panel's URL first: the router then has no copy of the list's URL, so a close
  // that navigates must ask the server. The focus goes to the selected row.
  for (const [name, close] of closes) {
    await page.goto(href);
    await closeAndCheck(`${name} after a load`, close);
  }
  // Opened by a click: the focus goes back to the row that opened the panel.
  for (const [name, close] of closes) {
    await row.click();
    await expect(page).toHaveURL(/\?tag=/);
    await closeAndCheck(`${name} after a click`, close);
  }
  expect(sent).toEqual([]);

  await member.context.close();
});

// Regression: the panel key was the `key` of `Panel`, so each click on another row mounted a new
// panel, which played its entrance again (2026-10-07 spec: the panel stays put).
test('regression: the panel stays mounted while the row changes', async ({ browser, t }) => {
  const member = await createMember(browser, t, {
    name: 'Nadia',
    email: 'nadia-tag-switch@e2e.test',
    seed: true,
  });
  const { page } = member;

  await page.goto('/profile/tags');
  const sent = pageRequests(page);
  const panel = page.getByRole('dialog', { name: t('tags.editTag') });
  const name = panel.getByLabel(t('tags.name'), { exact: true });
  await listRow(page, 'Vacanze').click();
  await expect(name).toHaveValue('Vacanze');
  await panel.evaluate((element) => {
    element.setAttribute('data-e2e-mark', 'first');
  });

  // D3: the scrim covers the rows, so a click cannot reach one. The link is clicked in the DOM, as
  // the panel's own controller sees it: what is under test is that the panel stays mounted.
  await listRow(page, 'Famiglia').dispatchEvent('click');
  // The body is a new form, in the same panel.
  await expect(name).toHaveValue('Famiglia');
  await expect(panel).toHaveAttribute('data-e2e-mark', 'first');
  await expect(listRow(page, 'Famiglia')).toHaveAttribute('aria-current', 'true');
  expect(sent).toEqual([]);

  await member.context.close();
});

// Regression: `PanelSwitch` with `slot` first rendered its panel through a portal, which renders
// nothing on the server. A load of `?tag=ID` painted the list alone, then the panel slid in.
test('regression: a ?tag=ID load renders the panel beside the list in the server HTML', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Ottavio',
    email: 'ottavio-tag-load@e2e.test',
    seed: true,
  });
  const { page } = member;
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/profile/tags');
  const href = await listRow(page, 'Vacanze').getAttribute('href');
  expect(href).toMatch(/\?tag=/);
  if (href === null) throw new Error('the row has no link');

  // W1: at 1440px the panel is a dialog in the centre, over the list. The poll waits for the entrance.
  await page.goto(href);
  const panel = page.getByRole('dialog', { name: t('tags.editTag') });
  await expect(panel.getByLabel(t('tags.name'), { exact: true })).toHaveValue('Vacanze');
  const box = async () => {
    const value = await panel.boundingBox();
    if (value === null) throw new Error('the panel has no box');
    return value;
  };
  await expect.poll(async () => Math.round((await box()).width)).toBe(480);
  const centred = await box();
  expect(Math.abs(centred.x + centred.width / 2 - 720)).toBeLessThanOrEqual(1);
  await expect(page.locator('[data-panel-switch]')).toBeVisible();

  // The server's HTML holds the panel and its form, before any script runs.
  const noScript = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await member.context.storageState(),
    locale: 'it-IT',
  });
  const raw = await noScript.newPage();
  await raw.goto(new URL(href, page.url()).toString());
  const field = raw.locator(
    `[role="dialog"][aria-label="${t('tags.editTag')}"] [data-field="name"] input`,
  );
  await expect(field).toHaveCount(1);
  await expect(field).toHaveValue('Vacanze');
  await noScript.close();

  await member.context.close();
});

/** The prefetches that the page sends from now on, as path and query, without Next's `_rsc`. */
function prefetchRequests(page: Page): string[] {
  const hrefs: string[] = [];
  page.on('request', (request) => {
    if (request.headers()['next-router-prefetch'] !== '1') return;
    const url = new URL(request.url());
    url.searchParams.delete('_rsc');
    hrefs.push(url.pathname + url.search);
  });
  return hrefs;
}

// Regression: a save in a panel ran `router.refresh()` after `router.replace`. The refresh made
// Next prefetch every visible link again: about 14 requests for each save on a Profilo page.
// Without any refresh the list kept the old name: a panel opened in place leaves the router on the
// page it rendered for the URL without the panel, so `router.replace` to that URL reused it.
test('regression: a save in a panel opened in place updates the list and prefetches no visible link again', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Pietro',
    email: 'pietro-tag-save@e2e.test',
    seed: true,
  });
  const { page } = member;
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/profile/tags');
  await page.waitForLoadState('networkidle');
  const panel = page.getByRole('dialog', { name: t('tags.editTag') });
  await listRow(page, 'Vacanze').click();
  // A page that shows the tag: left now, and entered again with Forward after the save.
  await panel.locator('a[href^="/transactions?tag="]').click();
  await expect(page).toHaveURL(/\/transactions\?tag=/);
  await expect(page.getByRole('main').getByText('Vacanze', { exact: true }).first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/profile\/tags\?tag=/);
  const name = panel.getByLabel(t('tags.name'), { exact: true });
  await expect(name).toHaveValue('Vacanze');

  const visibleLinks = await page
    .locator('nav a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  const prefetched = prefetchRequests(page);
  await name.fill('Ferie');
  await panel.getByRole('button', { name: t('common.save') }).click();
  await expect(page).toHaveURL(/\/profile\/tags$/);
  await expect(listRow(page, 'Ferie')).toBeVisible();
  await expect(listRow(page, 'Vacanze')).toHaveCount(0);
  // Next prefetches again after a pause of 300 ms: wait longer than that before the check.
  await page.waitForTimeout(1000);
  expect(prefetched.filter((href) => visibleLinks.includes(href))).toEqual([]);

  // The save also dropped the back/forward cache: Forward shows the new name.
  await page.goForward();
  await expect(page).toHaveURL(/\/transactions\?tag=/);
  await expect(page.getByRole('main').getByText('Ferie', { exact: true }).first()).toBeVisible();

  await member.context.close();
});
