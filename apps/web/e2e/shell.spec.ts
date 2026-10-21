import { catalogs, makeTranslator } from '@saldo/i18n';
import { clientHeaders, E2E_ORIGIN } from './env';
import { expect, test } from './fixtures';
import { openAdmin } from './support/admin';
import { createMember } from './support/members';
import { ADMIN } from './support/state';

test.describe('navigation', () => {
  test('a member sees the four tabs and no Admin, and /admin answers not found', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Nina', email: 'nina-nav@e2e.test' });
    const { page } = member;
    await page.goto('/home');

    const nav = page.getByRole('navigation', { name: t('web.shell.mainNav') });
    for (const key of ['tabs.home', 'tabs.transactions', 'tabs.stats', 'tabs.accounts']) {
      await expect(nav.getByRole('link', { name: t(key), exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole('banner').getByRole('link', { name: t('admin.title'), exact: true }),
    ).toHaveCount(0);
    // W10: the Admin group of the Profile menu is for the admin role only.
    await page.goto('/profile');
    await expect(
      page
        .getByRole('navigation', { name: t('profile.title') })
        .getByRole('link', { name: t('admin.nav.accounts') }),
    ).toHaveCount(0);

    // The panel does not admit that it exists.
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(404);
    // A section too, not only the index: the admin layout must refuse before anything streams.
    const section = await page.goto('/admin/accounts');
    expect(section?.status()).toBe(404);
    await member.context.close();
  });

  test('the admin finds Admin in the Profile menu, and each tab opens its section', async ({
    browser,
    t,
  }) => {
    const admin = await openAdmin(browser);
    const { page } = admin;
    await page.goto('/home');

    const nav = page.getByRole('navigation', { name: t('web.shell.mainNav') });
    // W10: Admin is not in the top bar; it is the last group of the Profile menu.
    await expect(
      page.getByRole('banner').getByRole('link', { name: t('admin.title'), exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: t('web.shell.accountMenu') }).click();
    await page.getByRole('menuitem', { name: t('profile.title') }).click();
    await expect(page).toHaveURL(/\/profile$/);
    const menu = page.getByRole('navigation', { name: t('profile.title') });
    await menu.getByRole('link', { name: t('admin.nav.accounts') }).click();
    await expect(page).toHaveURL(/\/admin\/accounts$/);
    for (const [key, path] of [
      ['tabs.transactions', '/transactions'],
      ['tabs.stats', '/stats'],
      ['tabs.accounts', '/accounts'],
      ['tabs.home', '/home'],
    ] as const) {
      await nav.getByRole('link', { name: t(key), exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
    await admin.context.close();
  });

  test('a signed-out browser is sent to /login from every section', async ({ page }) => {
    for (const path of ['/home', '/transactions', '/stats', '/accounts', '/profile']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('/budgets forwards to Profilo and keeps its query', async ({ browser, t }) => {
    const member = await createMember(browser, t, { name: 'Bea', email: 'bea-nav@e2e.test' });
    const { page } = member;
    await page.goto('/budgets?new&x=y');
    await expect(page).toHaveURL(/\/profile\/budgets\?new=?&x=y$/);
    await expect(page.getByRole('dialog', { name: t('budgets.newBudget') })).toBeVisible();
    await member.context.close();
  });
});

test.describe('PWA', () => {
  test('the manifest names the instance and every icon it lists answers', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      name: string;
      display: string;
      start_url: string;
      icons: { src: string; sizes: string; type: string }[];
    };
    expect(manifest.name).toBe(ADMIN.instance);
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const image = await request.get(icon.src);
      expect(image.status(), icon.src).toBe(200);
      expect(image.headers()['content-type'], icon.src).toContain(icon.type);
    }
  });

  test('the offline page renders without a session', async ({ page, t }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: t('web.offline.title') })).toBeVisible();
    await expect(page.getByText(t('web.offline.body'))).toBeVisible();
    await expect(page.getByRole('link', { name: t('web.offline.retry') })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('the service worker script is served from the root scope', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('javascript');
  });
});

test.describe('language from the browser', () => {
  test('a browser in English reads /login and /offline in English', async ({ browser }) => {
    const en = makeTranslator(catalogs.en);
    const context = await browser.newContext({
      locale: 'en-US',
      baseURL: E2E_ORIGIN,
      extraHTTPHeaders: clientHeaders(),
    });
    const page = await context.newPage();
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: en('web.auth.signInTitle') })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.goto('/offline');
    await expect(page.getByRole('heading', { name: en('web.offline.title') })).toBeVisible();
    await context.close();
  });
});
