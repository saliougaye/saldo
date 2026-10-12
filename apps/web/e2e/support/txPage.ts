import type { Locator, Page } from '@playwright/test';
import type { CurrencyCode } from '@saldo/core';
import type { SignDisplay, Translate } from '@saldo/i18n';
import { type AppLocale, formatDayMonth, formatMoney, formatWeekday } from '@saldo/i18n';
import { type Ledger, shiftDate } from './ledgerRows';

/** The locale the project runs in (`it-IT` → `it`), as the app's own formatters take it. */
export function appLocale(locale: string | undefined): AppLocale {
  return (locale ?? 'it').slice(0, 2) as AppLocale;
}

/** Money as the pages write it: the app's own formatter, so a figure is compared as it is read. */
export function moneyFormatter(ledger: Pick<Ledger, 'currency'>, locale: AppLocale) {
  return (minor: number, sign: SignDisplay = 'negative'): string =>
    formatMoney(minor, ledger.currency as CurrencyCode, locale, sign);
}

/** A key figure of Statistiche (the label, then the amount), not the chart legend that repeats the words. */
export function statFigure(page: Page, label: string): Locator {
  return page
    .locator('[class*="figures"] > div, [class*="HeroBand"][class*="figure"]')
    .filter({ has: page.getByText(label, { exact: true }) })
    .first();
}

/** «Oggi · 6 ott», «Ieri · 5 ott», then «Domenica · 4 ott»: the title of a day's section. */
export function dayHeading(date: string, today: string, t: Translate, locale: AppLocale): string {
  const weekday = formatWeekday(date, locale);
  const name =
    date === today
      ? t('txForm.today')
      : date === shiftDate(today, -1)
        ? t('txForm.yesterday')
        : weekday.charAt(0).toLocaleUpperCase(locale) + weekday.slice(1);
  return `${name} · ${formatDayMonth(date, locale)}`;
}

/** The innermost row (a link on Transazioni, a plain row on Statistiche) that holds `title`. */
export function rowOf(scope: Locator, title: string): Locator {
  return scope
    .locator('a, div')
    .filter({ has: scope.page().getByText(title, { exact: true }) })
    .last();
}

/** The section whose heading is `name`. */
export function sectionOf(page: Page, name: string): Locator {
  return page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name, exact: true }),
  });
}

interface NewExpense {
  amount: string;
  description: string;
  /** The category tile's name. */
  category: string;
}

/** Fills «Nuova transazione» as an expense and saves it. Returns the id the page lands on. */
export async function createExpense(page: Page, t: Translate, input: NewExpense): Promise<string> {
  await page.getByRole('link', { name: t('web.shell.newTransaction') }).click();
  const form = page.getByRole('dialog', { name: t('txForm.newTitle') });
  await form.getByLabel(t('txForm.amount')).fill(input.amount);
  await form.getByLabel(t('txForm.descriptionExpense')).fill(input.description);
  // The tiles only hold the categories used before; the full list is always there.
  await form.getByRole('button', { name: t('txForm.allCategories') }).click();
  await page.getByRole('option', { name: input.category, exact: true }).click();
  await form.getByRole('button', { name: t('txForm.create') }).click();
  await page.waitForURL(/[?&]t=/);
  const id = new URL(page.url()).searchParams.get('t');
  if (id === null) throw new Error('the saved transaction is not selected');
  return id;
}

/** One of Home's band figures («Uscite», «Entrate»…): the label and the amount under it. */
export function homeFigure(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator('..');
}

/** A regular expression that matches `text` literally. */
export function literal(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/**
 * The start of a screen-reader label with its last field left out: «Spesa, 117,35 € di 450,00 €, »
 * from the catalog's own template, so a changed sentence in the catalog changes the test with it.
 */
export function labelStart(t: Translate, key: string, vars: Record<string, string>): RegExp {
  const marker = '\u0000';
  const [start = ''] = t(key, { ...vars, status: marker }).split(marker);
  return new RegExp(`^${literal(start).source}`);
}
