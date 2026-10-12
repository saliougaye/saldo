import type { Page } from '@playwright/test';
import { getCurrency } from '@saldo/core';
import { catalogs, formatMoney, LANGUAGE_NAMES, makeTranslator, timeZoneCity } from '@saldo/i18n';
import { expect, test } from './fixtures';
import { createMember } from './support/members';

const PREFERENCES = '/profile/preferences';

/** A preference's row: its title leads the link's name, and the value follows (so «Tema» is not «Sistema»). */
function row(page: Page, title: string) {
  return page.getByRole('link', { name: new RegExp(`^${title}`) });
}

/** Opens one preference's editor in the profile panel, the way its row does. */
async function openEditor(page: Page, key: string) {
  await page.goto(`${PREFERENCES}?edit=${key}`);
}

test('the preferences list shows the five rows, and a row opens its panel and closes it', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Righe',
    email: 'prefs-rows@e2e.test',
  });
  const { page } = member;
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/profile\/account$/);

  await page
    .getByRole('link', { name: t('settings.preferences'), exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${PREFERENCES}$`));
  for (const label of [
    'profile.cycleStart',
    'profile.currency',
    'profile.language',
    'profile.theme',
    'profile.timeZone',
  ] as const) {
    await expect(row(page, t(label))).toBeVisible();
  }

  await row(page, t('profile.theme')).click();
  await expect(page).toHaveURL(/edit=theme$/);
  const panel = page.getByRole('dialog', { name: t('profile.theme') });
  await expect(panel).toBeVisible();

  await panel.getByRole('link', { name: t('common.close') }).click();
  await expect(page).toHaveURL(new RegExp(`${PREFERENCES}$`));
  await expect(panel).toHaveCount(0);
  await member.context.close();
});

test('the theme is saved as chosen, sets the document and survives a reload', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Tema',
    email: 'prefs-theme@e2e.test',
  });
  const { page } = member;
  await openEditor(page, 'theme');
  const list = page.getByRole('radiogroup', { name: t('profile.theme') });
  await expect(list.getByRole('radio', { name: t('profile.system') })).toBeChecked();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

  await list.getByRole('radio', { name: t('profile.dark') }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(row(page, t('profile.theme'))).toContainText(t('profile.dark'));

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(list.getByRole('radio', { name: t('profile.dark') })).toBeChecked();

  await list.getByRole('radio', { name: t('profile.light') }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await member.context.close();
});

test('the language re-renders the whole shell in the chosen language and survives a reload', async ({
  browser,
  t,
}) => {
  const en = makeTranslator(catalogs.en);
  const member = await createMember(browser, t, {
    name: 'Prefs Lingua',
    email: 'prefs-lang@e2e.test',
  });
  const { page } = member;
  await openEditor(page, 'language');
  const list = page.getByRole('radiogroup', { name: t('profile.language') });
  await expect(list.getByRole('radio', { name: t('profile.system') })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');

  await list.getByRole('radio', { name: LANGUAGE_NAMES.en }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(row(page, en('profile.language'))).toContainText(LANGUAGE_NAMES.en);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(
    page.getByRole('radiogroup', { name: en('profile.language') }).getByRole('radio', {
      name: LANGUAGE_NAMES.en,
    }),
  ).toBeChecked();

  // Back to the browser's own language.
  await page
    .getByRole('radiogroup', { name: en('profile.language') })
    .getByRole('radio', { name: en('profile.system') })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await member.context.close();
});

test('the cycle start day previews the cycle, is saved as chosen and survives a reload', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Ciclo',
    email: 'prefs-cycle@e2e.test',
  });
  const { page } = member;
  await openEditor(page, 'cycle');
  const days = page.getByRole('radiogroup', { name: t('profile.cycleStart') });
  await expect(
    days.getByRole('radio', { name: t('profile.cycleDay', { day: 15 }), exact: true }),
  ).not.toBeChecked();

  const preview = page
    .getByText(t('profile.cyclePreview'))
    .locator('xpath=following-sibling::*[1]');
  const before = await preview.textContent();
  await days.getByRole('radio', { name: t('profile.cycleDay', { day: 15 }), exact: true }).click();
  await expect(
    days.getByRole('radio', { name: t('profile.cycleDay', { day: 15 }), exact: true }),
  ).toBeChecked();
  await expect(preview).not.toHaveText(before ?? '');
  await expect(row(page, t('profile.cycleStart'))).toContainText(
    t('settings.cycleValue', { day: 15 }),
  );

  await page.reload();
  await expect(
    days.getByRole('radio', { name: t('profile.cycleDay', { day: 15 }), exact: true }),
  ).toBeChecked();
  await expect(row(page, t('profile.cycleStart'))).toContainText(
    t('settings.cycleValue', { day: 15 }),
  );
  await member.context.close();
});

test('the currency asks first: cancel keeps it, confirm saves it and survives a reload', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Valuta',
    email: 'prefs-currency@e2e.test',
  });
  const { page } = member;
  await openEditor(page, 'currency');
  const list = page.getByRole('radiogroup', { name: t('profile.currency') });
  await expect(list.getByRole('radio', { name: /^EUR/ })).toBeChecked();

  // Same number of decimals: the plain body.
  await list.getByRole('radio', { name: /^USD/ }).click();
  const dialog = page.getByRole('alertdialog', { name: t('profile.currencyConfirmTitle') });
  await expect(dialog).toContainText(t('profile.currencyConfirmBody'));
  await dialog.getByRole('button', { name: t('common.cancel') }).click();
  await expect(dialog).toHaveCount(0);
  await expect(list.getByRole('radio', { name: /^EUR/ })).toBeChecked();

  // A currency without minor digits: the dialog says where the point moves, and still saves.
  expect(getCurrency('JPY').minorDigits).not.toBe(getCurrency('EUR').minorDigits);
  await list.getByRole('radio', { name: /^JPY/ }).click();
  await expect(dialog).toContainText(
    t('profile.currencyConfirmScale', {
      before: formatMoney(184260, 'EUR', 'it'),
      after: formatMoney(184260, 'JPY', 'it'),
    }),
  );
  await dialog.getByRole('button', { name: t('common.cancel') }).click();
  await expect(dialog).toHaveCount(0);

  await list.getByRole('radio', { name: /^USD/ }).click();
  await dialog.getByRole('button', { name: t('common.save') }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row(page, t('profile.currency'))).toContainText(`${getCurrency('USD').symbol} USD`);

  await page.reload();
  await expect(list.getByRole('radio', { name: /^USD/ })).toBeChecked();
  await expect(row(page, t('profile.currency'))).toContainText('USD');
  await member.context.close();
});

test('the currency search narrows the list and says when nothing matches', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Cerca',
    email: 'prefs-search@e2e.test',
  });
  const { page } = member;
  await openEditor(page, 'currency');
  const list = page.getByRole('radiogroup', { name: t('profile.currency') });
  const search = page.getByLabel(t('currencyPicker.search'));

  await expect(list.getByRole('radio', { name: /^CHF/ })).toBeVisible();
  await search.fill('CHF');
  await expect(list.getByRole('radio')).toHaveCount(1);
  await expect(list.getByRole('radio', { name: /^CHF/ })).toBeVisible();

  await search.fill('zzzzzz');
  await expect(page.getByText(t('currencyPicker.noResults'))).toBeVisible();
  await expect(list.getByRole('radio')).toHaveCount(0);
  await member.context.close();
});

test('the time zone is searched by city, saved as chosen and survives a reload', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Fuso',
    email: 'prefs-zone@e2e.test',
  });
  const { page } = member;
  await openEditor(page, 'timeZone');
  const list = page.getByRole('radiogroup', { name: t('profile.timeZone') });
  const tokyo = timeZoneCity('Asia/Tokyo', 'it');

  await page.getByLabel(t('timeZone.search')).fill('zzzzzz');
  await expect(page.getByText(t('timeZone.noResults'))).toBeVisible();

  await page.getByLabel(t('timeZone.search')).fill(tokyo);
  await list.getByRole('radio', { name: new RegExp(`^${tokyo}`) }).click();
  await expect(list.getByRole('radio', { name: new RegExp(`^${tokyo}`) })).toBeChecked();
  await expect(row(page, t('profile.timeZone'))).toContainText(tokyo);

  await page.reload();
  await expect(row(page, t('profile.timeZone'))).toContainText(tokyo);
  await expect(page.getByLabel(t('timeZone.search'))).toHaveValue('');
  await page.getByLabel(t('timeZone.search')).fill(tokyo);
  await expect(list.getByRole('radio', { name: new RegExp(`^${tokyo}`) })).toBeChecked();
  await member.context.close();
});

test('the time zone row opens its list in place, with the hours of this browser', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Fuso Posto',
    email: 'prefs-zone-place@e2e.test',
  });
  const { page } = member;
  await page.goto(PREFERENCES);
  // The requests of a navigation; a prefetch is not one.
  const requests: string[] = [];
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers.rsc === '1' && headers['next-router-prefetch'] === undefined) {
      requests.push(request.url());
    }
  });

  const zoneRow = row(page, t('profile.timeZone'));
  await zoneRow.click();
  await expect(page).toHaveURL(/edit=timeZone$/);
  const list = page.getByRole('radiogroup', { name: t('profile.timeZone') });
  const tokyo = list.getByRole('radio', {
    name: new RegExp(`^${timeZoneCity('Asia/Tokyo', 'it')}`),
  });
  await expect(tokyo).toBeVisible();
  // The hour in Tokyo as this browser reads it now: the panel did not get it from a render. Read
  // again on each try, so a new minute during the check does not fail it.
  const tokyoHour = () =>
    page.evaluate(() =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    );
  await expect
    .poll(async () => (await tokyo.textContent())?.includes(await tokyoHour()))
    .toBe(true);
  expect(requests).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`${PREFERENCES}$`));
  await expect(list).toHaveCount(0);
  await expect(zoneRow).toBeFocused();
  expect(requests).toEqual([]);
  await member.context.close();
});

test('the account shows the name and the email, and says the address stays unverified without mail', async ({
  browser,
  t,
}) => {
  const member = await createMember(browser, t, {
    name: 'Prefs Account',
    email: 'prefs-account@e2e.test',
  });
  const { page } = member;
  await page.goto('/profile/account');
  await expect(page.getByText(member.name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(member.email, { exact: true }).first()).toBeVisible();
  // The harness configures no SMTP: the address cannot be confirmed, and the page says so instead
  // of offering a button that would fail.
  await expect(page.getByText(t('web.account.unverified'))).toBeVisible();
  await expect(page.getByText(t('web.account.mailOff'))).toBeVisible();
  await expect(page.getByRole('button', { name: t('web.account.verify') })).toHaveCount(0);
  await member.context.close();
});
