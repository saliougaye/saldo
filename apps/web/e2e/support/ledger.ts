import { expect, type Locator, type Page } from '@playwright/test';
import { formatMoney, type Translate } from '@saldo/i18n';

/** The money the app prints for a member of the default onboarding (EUR, Italian). */
export function money(minor: number): string {
  return formatMoney(minor, 'EUR', 'it');
}

/** Today's date in the browser's zone, as `YYYY-MM-DD`: the form's own default day. */
export function localToday(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A list row (a link with a title) in the page's main column, found by the title it shows. */
export function listRow(page: Page, title: string): Locator {
  return page
    .getByRole('main')
    .getByRole('link')
    .filter({ has: page.getByText(title, { exact: true }) });
}

/** A name that starts with `text` as a whole word: «1» is not «10», «Conto» is not «Contanti». */
export function startsWith(text: string): RegExp {
  return new RegExp(`^${escapeRegExp(text)}(\\s|$)`);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Opens a Base UI select by its label and picks one option (an account's name may carry its balance). */
export async function pickOption(page: Page, label: string, option: string): Promise<void> {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: startsWith(option) }).click();
  // Another select opens while this one still animates out: wait until its list is gone.
  await expect(page.getByRole('listbox')).toBeHidden();
}

export interface NewTransaction {
  kind?: 'expense' | 'income' | 'transfer';
  /** What the field takes: `12,50` or `100`. */
  amount: string;
  description?: string;
  category?: string;
  /** The account of an expense or an income; the source of a transfer. */
  account?: string;
  /** The destination of a transfer. */
  to?: string;
  /** Typed in the tag field; a name that does not exist yet is created on the spot. */
  tag?: string;
}

/** Fills and saves the new-transaction form (`/transactions?new`) and waits for the saved row. */
export async function addTransaction(
  page: Page,
  t: Translate,
  tx: NewTransaction,
  url = '/transactions?new',
): Promise<void> {
  await page.goto(url);
  await fillTransaction(page, t, tx);
  await saveTransaction(page, t);
}

/** The fields of the form, for a form a link has already opened (a goal's «Accantona»). */
export async function fillTransaction(page: Page, t: Translate, tx: NewTransaction): Promise<void> {
  const amount = page.getByRole('textbox', { name: t('txForm.amount') });
  await expect(amount).toBeVisible();
  const kind = tx.kind ?? 'expense';
  if (kind !== 'expense') {
    await page.getByRole('radio', { name: t(`kinds.${kind}`) }).click();
  }
  await amount.fill(tx.amount);

  if (kind === 'transfer') {
    if (tx.account !== undefined) await pickOption(page, t('txForm.from'), tx.account);
    if (tx.to !== undefined) await pickOption(page, t('txForm.to'), tx.to);
    return;
  }

  if (tx.description !== undefined) {
    await page
      .getByLabel(t(kind === 'income' ? 'txForm.descriptionIncome' : 'txForm.descriptionExpense'), {
        exact: true,
      })
      .fill(tx.description);
  }
  if (tx.category !== undefined) {
    const tile = page.getByRole('button', { name: tx.category, exact: true });
    if ((await tile.count()) > 0) {
      await tile.click();
      await expect(tile).toHaveAttribute('aria-pressed', 'true');
    } else {
      await page.getByRole('button', { name: t('txForm.allCategories') }).click();
      await page.getByRole('option', { name: tx.category, exact: true }).click();
      await expect(page.getByRole('button', { name: tx.category, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
  }
  if (tx.account !== undefined) await pickOption(page, t('txForm.account'), tx.account);
  if (tx.tag !== undefined) {
    const field = page.getByLabel(t('transactions.tags'), { exact: true });
    await field.fill(tx.tag);
    await field.press('Enter');
    await expect(page.getByText(`#${tx.tag}`)).toBeVisible();
  }
}

/** «Aggiungi»: submits the form and waits for where a save lands: the saved row, by default. */
export async function saveTransaction(
  page: Page,
  t: Translate,
  landing: RegExp = /\/transactions\?(.*&)?t=/,
): Promise<void> {
  await page.getByRole('button', { name: t('txForm.create'), exact: true }).click();
  await expect(page).toHaveURL(landing);
}
