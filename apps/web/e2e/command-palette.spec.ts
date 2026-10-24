import { expect, test } from './fixtures';
import { addTransaction } from './support/ledger';
import { createMember } from './support/members';

const MAIN = 'Conto principale';

test.describe('command palette', () => {
  test('the keyboard opens it, finds an account and a transaction, and opens them', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, { name: 'Paletta', email: 'palette@e2e.test' });
    const { page } = member;
    await addTransaction(page, t, {
      amount: '12,34',
      description: 'Gelateria Pistacchio',
      category: 'Sport',
    });

    await page.goto('/home');
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: t('web.search.title') });
    const field = palette.getByRole('combobox', { name: t('web.search.title') });
    await expect(field).toBeFocused();
    // An empty query: the actions and the main pages.
    await expect(
      palette.getByRole('option', { name: t('web.shell.newTransaction') }),
    ).toBeVisible();

    await field.fill('principale');
    await expect(palette.getByRole('option', { name: new RegExp(MAIN) })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/accounts\?a=/);
    await expect(palette).toBeHidden();
    await expect(page.getByRole('dialog', { name: MAIN })).toBeVisible();

    await page.goto('/home');
    await page.keyboard.press('ControlOrMeta+k');
    await field.fill('12,34');
    const tx = palette.getByRole('option', { name: /Gelateria Pistacchio/ });
    await expect(tx).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/transactions\?t=/);
    await expect(page.getByRole('dialog', { name: t('txForm.editTitle') })).toBeVisible();

    // No match: a sentence, and the row that opens Transactions with the query.
    await page.goto('/home');
    await page.keyboard.press('ControlOrMeta+k');
    await field.fill('zzzz');
    const noMatch = t('web.search.noResults', { query: 'zzzz' });
    await expect(palette.getByRole('paragraph').filter({ hasText: noMatch })).toBeVisible();
    // The status region says it as well, for a screen reader.
    await expect(palette.getByRole('status')).toHaveText(noMatch);
    await palette.getByRole('option', { name: t('web.search.seeAll', { query: 'zzzz' }) }).click();
    await expect(page).toHaveURL(/\/transactions\?q=zzzz$/);

    // Esc closes it, and the focus goes back to the button that opened it.
    const trigger = page.getByRole('banner').getByRole('button', { name: t('common.search') });
    await trigger.click();
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(trigger).toBeFocused();
    await member.context.close();
  });

  test('«Search» shows from 1000px; the shortcut opens the palette at every width', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Stretta',
      email: 'palette-narrow@e2e.test',
    });
    const { page } = member;
    const trigger = page.getByRole('banner').getByRole('button', { name: t('common.search') });
    const palette = page.getByRole('dialog', { name: t('web.search.title') });

    for (const [width, shown] of [
      [1280, true],
      [900, false],
      [390, false],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/home');
      if (shown) await expect(trigger).toBeVisible();
      else await expect(trigger).toBeHidden();
      await page.keyboard.press('ControlOrMeta+k');
      await expect(palette).toBeVisible();
      await page.keyboard.press('ControlOrMeta+k');
      await expect(palette).toBeHidden();
    }
    await member.context.close();
  });
});
