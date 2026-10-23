import { expect, test } from './fixtures';
import { openAdmin } from './support/admin';

/**
 * Right after `01-setup`, before any spec mints an invite for its members: the only moment the
 * shared database has no invite, so this file runs second (Playwright takes the files in order).
 */
test('REGRESSION: the first invite minted in the page keeps its code on screen until «Fatto»', async ({
  browser,
  t,
}) => {
  // The mint revalidated `/admin`, the page came back with one row, and the form under the empty
  // state unmounted: the code, held only in its state, was never shown.
  const { page } = await openAdmin(browser);
  await page.goto('/admin/invites');
  const main = page.getByRole('main');
  await expect(main.getByText(t('admin.invites.createFirst'))).toBeVisible();

  await main.getByLabel(t('admin.invites.label')).fill('Primo invito');
  await main.getByRole('button', { name: t('admin.invites.create') }).click();

  await expect(main.getByText(t('admin.invites.copyNow'))).toBeVisible();
  const code = main.locator('p', { hasText: /^[A-Z0-9-]{16,}$/ }).first();
  await expect(code).toBeVisible();
  await expect(main.getByRole('link', { name: /Primo invito/ })).toBeVisible();

  await main.getByRole('button', { name: t('admin.invites.done') }).click();
  await expect(main.getByText(t('admin.invites.copyNow'))).toHaveCount(0);
  await expect(main.getByText(t('admin.invites.createFirst'))).toHaveCount(0);
});
