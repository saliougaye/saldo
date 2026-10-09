import { expect, test } from './fixtures';
import { finishOnboarding } from './support/onboarding';
import { ADMIN, ADMIN_STORAGE } from './support/state';

test('the first-run wizard creates the admin with a passkey', async ({
  page,
  t,
  authenticator,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole('heading', { name: t('setup.welcomeTitle') })).toBeVisible();
  await page.getByRole('button', { name: t('common.start') }).click();

  await page.getByLabel(t('setup.nameLabel')).fill(ADMIN.instance);
  await page.getByRole('button', { name: t('common.continue') }).click();

  // The server step saves before the next one shows: wait for it, or the fills below land on step 1.
  await expect(page.getByRole('heading', { name: t('setup.accountTitle') })).toBeVisible();
  // An empty name is refused before the ceremony: no passkey is asked for.
  await page.getByRole('button', { name: t('setup.createButton') }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: t('web.auth.nameRequiredTitle') }),
  ).toBeVisible();
  expect(await authenticator.credentials()).toHaveLength(0);

  await page.getByLabel(t('setup.yourNameLabel'), { exact: true }).fill(ADMIN.name);
  await page.getByLabel(t('web.auth.emailLabel')).fill(ADMIN.email);
  await page.getByRole('button', { name: t('setup.createButton') }).click();

  await expect(page.getByRole('heading', { name: t('setup.doneTitle') })).toBeVisible();
  expect(await authenticator.credentials()).toHaveLength(1);

  await page.getByRole('button', { name: t('setup.go') }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await finishOnboarding(page, t);
  await expect(page).toHaveURL(/\/home$/);

  await page.context().storageState({ path: ADMIN_STORAGE });
});
