import type { Locator } from '@playwright/test';
import { formatDayMonth, formatMonthLong, plural } from '@saldo/i18n';
import { expect, test } from './fixtures';
import {
  categoryFamily,
  counted,
  inRange,
  type Ledger,
  type LedgerTransaction,
  monthOf,
  previousMonth,
  readLedger,
  sum,
  summary,
} from './support/ledgerRows';
import { createMember } from './support/members';
import {
  appLocale,
  homeFigure,
  labelStart,
  moneyFormatter,
  rowOf,
  sectionOf,
  statFigure,
} from './support/txPage';

function upperFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase('it') + text.slice(1);
}

/** What a goal has put aside: transfers into the pocket, less transfers out of it. */
function saved(ledger: Ledger, pocketId: string): number {
  return ledger.transactions
    .filter((tx) => tx.kind === 'transfer' && tx.date <= ledger.today)
    .reduce(
      (total, tx) =>
        total +
        (tx.toAccountId === pocketId ? tx.amount : 0) -
        (tx.accountId === pocketId ? tx.amount : 0),
      0,
    );
}

function percentOf(part: number, whole: number): number {
  return Math.round((part / whole) * 100);
}

test.describe('Home', () => {
  test('the band, «In arrivo» and «Ultime transazioni» add up from the rows', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Casa',
      email: 'home-summary@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const month = monthOf(ledger.today);
    test.skip(
      ledger.today === month.end,
      'nothing is dated ahead inside the period on its last day',
    );
    const { income, spent } = summary(ledger, month);

    await page.goto('/home');
    await expect(
      page.getByText(upperFirst(formatMonthLong(month.end, lang)), { exact: true }),
    ).toBeVisible();
    await expect(homeFigure(page, t('home.income'))).toContainText(money(income));
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(spent));
    await expect(homeFigure(page, t('home.remaining'))).toContainText(money(income - spent));

    // «In arrivo»: every row dated ahead, up to the five the card shows.
    const ahead = ledger.transactions
      .filter((tx) => tx.date > ledger.today && tx.date <= month.end)
      .sort((a, b) => a.date.localeCompare(b.date));
    expect(ahead.length).toBeGreaterThanOrEqual(2);
    // Transazioni holds both lists: the group label tells «In arrivo» from «Ultime». The summary
    // beside the title says how many there are; its amount is left out (it adds the rows up).
    const transactions = sectionOf(page, t('tabs.transactions'));
    const marker = '\u0000';
    const [summaryStart = ''] = plural(t, lang, 'home.upcomingSummary', ahead.length, {
      amount: marker,
    }).split(marker);
    await expect(transactions).toContainText(summaryStart);
    const upcoming = transactions
      .locator('div')
      .filter({
        has: page.getByText(t('home.upcomingUntil', { date: formatDayMonth(month.end, lang) }), {
          exact: true,
        }),
      })
      .last();
    await expect(upcoming.getByRole('link')).toHaveCount(Math.min(5, ahead.length));
    for (const tx of ahead.slice(0, 5)) {
      await expect(upcoming.getByRole('link', { name: tx.description })).toContainText(
        money(-tx.amount),
      );
    }

    // «Ultime transazioni»: the five newest rows that have already happened.
    const settled = ledger.transactions.filter(
      (tx) => tx.date <= ledger.today && inRange(tx.date, month),
    );
    const recent = transactions
      .locator('div')
      .filter({ has: page.getByText(t('home.latest'), { exact: true }) })
      .last();
    await expect(recent.locator('a[href^="/transactions?t="]')).toHaveCount(
      Math.min(5, settled.length),
    );
    expect(settled.length).toBeGreaterThan(0);
    const newest = [...settled].sort((a, b) =>
      b.date.localeCompare(a.date),
    )[0] as LedgerTransaction;
    await expect(recent.locator('a[href^="/transactions?t="]').first()).toContainText(
      formatDayMonth(newest.date, lang),
    );

    await transactions.getByRole('link', { name: t('home.allTransactions') }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await member.context.close();
  });

  test('the budgets and the goals carry the seeded figures', async ({ browser, t, locale }) => {
    const member = await createMember(browser, t, {
      name: 'Obiettivi',
      email: 'home-targets@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const month = monthOf(ledger.today);
    const percent = (value: number) => t('targets.percent', { value });
    const ofLine = (limit: number, spentSoFar: number) =>
      t('targets.ofLimit', {
        amount: money(limit),
        percent: percent(percentOf(spentSoFar, limit)),
      });

    await page.goto('/home');

    // Budgets: what each one has spent is the sum of its categories' expenses this month.
    expect(ledger.budgets).toHaveLength(3);
    for (const budget of ledger.budgets) {
      const covered = new Set(budget.categoryIds.flatMap((id) => categoryFamily(ledger, id)));
      const spentSoFar = sum(
        counted(ledger, month).filter(
          (tx) => tx.kind === 'expense' && tx.categoryId !== null && covered.has(tx.categoryId),
        ),
      );
      await expect(
        page.getByText(
          labelStart(t, 'targets.itemLabel', {
            name: budget.name,
            amount: money(spentSoFar),
            limit: money(budget.amount),
          }),
        ),
      ).toHaveCount(1);
      // H6: every budget is a ring tile; under what is left, a line says what is spent.
      await expect(
        page.getByText(t('targets.spent', { amount: money(spentSoFar) }), { exact: true }).first(),
      ).toBeVisible();
    }

    // Goals: a pocket's balance is the transfers into it.
    const goals = ledger.accounts.filter((account) => account.type === 'pocket');
    expect(goals).toHaveLength(2);
    for (const goal of goals) {
      const target = goal.goalTarget ?? 0;
      const put = saved(ledger, goal.id);
      expect(put).toBeGreaterThan(0);
      await expect(
        page.getByText(
          labelStart(t, 'goals.itemLabel', {
            name: goal.name,
            amount: money(put),
            target: money(target),
          }),
        ),
      ).toHaveCount(1);
      // Every goal is a card too, with the same «of» line under its figure.
      await expect(page.getByText(ofLine(target, put), { exact: true })).toHaveCount(1);
    }
    await member.context.close();
  });

  test('«Non a budget» adds up the spend that no budget covers, and opens a new budget', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Fuori budget',
      email: 'home-unbudgeted@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const month = monthOf(ledger.today);
    const covered = new Set(
      ledger.budgets.flatMap((budget) =>
        budget.categoryIds.flatMap((id) => categoryFamily(ledger, id)),
      ),
    );
    const outside = sum(
      counted(ledger, month).filter(
        (tx) => tx.kind === 'expense' && tx.categoryId !== null && !covered.has(tx.categoryId),
      ),
    );
    // The seed must spend outside its budgets, or the test would pass on a zero.
    expect(outside).toBeGreaterThan(0);

    await page.goto('/home');
    const card = page
      .locator('a[href="/profile/budgets?new"]')
      .filter({ hasText: t('home.unbudgeted') });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(money(outside));
    await expect(card).toContainText(t('targets.createBudget'));
    await member.context.close();
  });

  test('‹ steps back to a closed period, › is disabled on the current one', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Periodi',
      email: 'home-period@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const current = monthOf(ledger.today);
    const closed = previousMonth(current);
    const earlier = previousMonth(closed);
    const title = (range: { end: string }) => upperFirst(formatMonthLong(range.end, lang));
    const next = page.getByRole('link', { name: t('web.shell.nextPeriod') });
    const previous = page.getByRole('link', { name: t('web.shell.previousPeriod') });

    await page.goto('/home');
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    await expect(next).toHaveCount(0);

    await previous.click();
    const lastMonth = summary(ledger, closed);
    await expect(page.getByText(title(closed), { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`[?&]p=${closed.start}`));
    await expect(page.getByText(t('home.closedCycle')).first()).toBeVisible();
    await expect(homeFigure(page, t('home.income'))).toContainText(money(lastMonth.income));
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(lastMonth.spent));
    await expect(homeFigure(page, t('home.leftover'))).toContainText(
      money(lastMonth.income - lastMonth.spent),
    );
    await expect(next).toBeVisible();

    await previous.click();
    const before = summary(ledger, earlier);
    await expect(page.getByText(title(earlier), { exact: true })).toBeVisible();
    await expect(homeFigure(page, t('home.expenses'))).toContainText(money(before.spent));

    // Each click is a navigation: wait for its page before the next click, or both land on one link.
    await next.click();
    await expect(page.getByText(title(closed), { exact: true })).toBeVisible();
    await next.click();
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    await expect(next).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]p=/);
    await member.context.close();
  });

  test('the trend moves day by day with the arrow keys (H5)', async ({ browser, t }) => {
    const member = await createMember(browser, t, {
      name: 'Andamento',
      email: 'home-trend@e2e.test',
      seed: true,
    });
    const { page } = member;
    await page.goto('/home');
    const trend = page.getByRole('slider', { name: t('stats.cycleTrend') });
    await trend.focus();
    await page.keyboard.press('Home');
    await expect(trend).toHaveAttribute('aria-valuenow', '1');
    await page.keyboard.press('ArrowRight');
    await expect(trend).toHaveAttribute('aria-valuenow', '2');
    await page.keyboard.press('End');
    const last = await trend.getAttribute('aria-valuemax');
    await expect(trend).toHaveAttribute('aria-valuenow', last ?? '');
    await member.context.close();
  });
});

/** A category card of Ripartizione: the link that holds the category's name. */
function cardOf(scope: Locator, name: string): Locator {
  // By role, not by class name: a production build hashes CSS-module names and drops the file name.
  return scope.getByRole('link').filter({ has: scope.page().getByText(name, { exact: true }) });
}

test.describe('Statistiche', () => {
  test('Ripartizione and Tag add up to the rows of a closed month', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Statistiche',
      email: 'stats-split@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const closed = previousMonth(monthOf(ledger.today));
    const rows = counted(ledger, closed);
    const parentOf = new Map(ledger.categories.map((c) => [c.id, c.parentId ?? c.id]));
    const nameOf = new Map(ledger.categories.map((c) => [c.id, c.name]));

    /** Counted amounts of one direction, rolled up to the top-level category and ranked. */
    const split = (kind: 'expense' | 'income') => {
      const amounts = new Map<string, number>();
      for (const tx of rows.filter((row) => row.kind === kind)) {
        const id = parentOf.get(tx.categoryId ?? '') ?? '';
        amounts.set(id, (amounts.get(id) ?? 0) + tx.amount);
      }
      const total = [...amounts.values()].reduce((a, b) => a + b, 0);
      const ranked = [...amounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([id, amount]) => ({ name: nameOf.get(id) ?? '', amount }));
      return { total, ranked };
    };

    await page.goto(`/stats?p=${closed.start}`);
    const section = sectionOf(page, t('stats.split'));

    const expenses = split('expense');
    expect(expenses.ranked.length).toBeGreaterThan(5);
    const income = split('income');
    // The closed month has income, so the loop below reads a populated income view.
    expect(income.ranked.length).toBeGreaterThan(0);
    // The figures above the split agree with it.
    await expect(statFigure(page, t('stats.expenses'))).toContainText(money(expenses.total));
    for (const { name, amount } of expenses.ranked) {
      const card = cardOf(section, name);
      await expect(card).toContainText(money(amount));
      await expect(card).toContainText(
        t('targets.percent', { value: percentOf(amount, expenses.total) }),
      );
    }
    // Biggest first.
    const first = expenses.ranked[0];
    await expect(cardOf(section, first?.name ?? '')).toBeVisible();
    const cards = section.locator('a[href*="c="]');
    await expect(cards).toHaveCount(expenses.ranked.length);
    for (const [index, row] of expenses.ranked.entries()) {
      await expect(cards.nth(index).getByText(row.name, { exact: true })).toBeVisible();
    }

    // The same month read as income.
    await section.getByRole('link', { name: t('stats.income') }).click();
    await expect(page).toHaveURL(/direction=income/);
    for (const { name, amount } of income.ranked) {
      await expect(cardOf(sectionOf(page, t('stats.split')), name)).toContainText(money(amount));
    }

    // Tag: every tag used by a counted row, with its spend, its income and how many rows carry it.
    const tagsSection = sectionOf(page, t('stats.tags'));
    const used = ledger.tags
      .map((tag) => {
        const tagged = rows.filter((tx) => tx.tagIds.includes(tag.id));
        return {
          tag,
          count: tagged.length,
          expense: sum(tagged.filter((tx) => tx.kind === 'expense')),
          income: sum(tagged.filter((tx) => tx.kind === 'income')),
        };
      })
      .filter((entry) => entry.count > 0);
    expect(used.length).toBeGreaterThanOrEqual(2);
    for (const entry of used) {
      const row = rowOf(tagsSection, entry.tag.name);
      await expect(row).toContainText(plural(t, lang, 'tags.uses', entry.count));
      if (entry.expense > 0) await expect(row).toContainText(money(entry.expense));
      if (entry.income > 0) {
        await expect(row).toContainText(money(entry.income, 'always'));
      }
    }
    const untagged = rows.filter((tx) => tx.kind === 'expense' && tx.tagIds.length === 0);
    await expect(tagsSection).toContainText(
      plural(t, lang, 'stats.tagsUntagged', untagged.length, { amount: money(sum(untagged)) }),
    );

    // A tag row opens the list filtered by it, in the same period.
    const family = used.find((entry) => entry.tag.name === 'Famiglia');
    expect(family).toBeDefined();
    await rowOf(tagsSection, 'Famiglia').click();
    await expect(page).toHaveURL(/\/transactions\?/);
    await expect(page).toHaveURL(new RegExp(`tag=${family?.tag.id}`));
    await expect(page.locator('section:not(details section) a')).toHaveCount(
      ledger.transactions.filter(
        (tx) => inRange(tx.date, closed) && tx.tagIds.includes(family?.tag.id ?? ''),
      ).length,
    );
    await member.context.close();
  });

  test('a category card opens a dialog with the category and one of its transactions', async ({
    browser,
    t,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Categoria',
      email: 'stats-category@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const closed = previousMonth(monthOf(ledger.today));
    const parentOf = new Map(ledger.categories.map((c) => [c.id, c.parentId ?? c.id]));
    const nameOf = new Map(ledger.categories.map((c) => [c.id, c.name]));
    const spent = new Map<string, number>();
    for (const tx of counted(ledger, closed).filter((row) => row.kind === 'expense')) {
      const id = parentOf.get(tx.categoryId ?? '') ?? '';
      spent.set(id, (spent.get(id) ?? 0) + tx.amount);
    }
    const [topId] = [...spent.entries()].sort(([, a], [, b]) => b - a)[0] ?? [];
    const name = nameOf.get(topId ?? '') ?? '';
    const inside = counted(ledger, closed).find(
      (tx) => tx.kind === 'expense' && parentOf.get(tx.categoryId ?? '') === topId,
    );
    expect(inside).toBeDefined();

    await page.goto(`/stats?p=${closed.start}`);
    await cardOf(sectionOf(page, t('stats.split')), name).click();
    const dialog = page.getByRole('dialog', { name });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`c=${topId}`));
    await expect(dialog.getByText(inside?.description ?? '').first()).toBeVisible();

    await dialog.getByRole('link', { name: t('common.close') }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]c=/);
    await member.context.close();
  });

  test('‹ moves the figures and the title to the previous period', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Passi',
      email: 'stats-period@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const money = moneyFormatter(ledger, lang);
    const current = monthOf(ledger.today);
    const closed = previousMonth(current);
    const title = (range: { end: string }) => upperFirst(formatMonthLong(range.end, lang));
    const figure = (label: string) => statFigure(page, label);

    await page.goto('/stats');
    const now = summary(ledger, current);
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    await expect(page.getByText(t('stats.soFar')).first()).toBeVisible();
    await expect(figure(t('stats.expenses'))).toContainText(money(now.spent));

    await page.getByRole('link', { name: t('web.shell.previousPeriod') }).click();
    const last = summary(ledger, closed);
    await expect(page.getByText(title(closed), { exact: true })).toBeVisible();
    await expect(page.getByText(t('period.closed')).first()).toBeVisible();
    await expect(figure(t('stats.income'))).toContainText(money(last.income));
    await expect(figure(t('stats.expenses'))).toContainText(money(last.spent));
    await expect(figure(t('stats.net'))).toContainText(money(last.income - last.spent, 'always'));
    await member.context.close();
  });

  test('a bar of the chart selects its period, and ← → move it (W6)', async ({
    browser,
    t,
    locale,
  }) => {
    const member = await createMember(browser, t, {
      name: 'Grafico',
      email: 'stats-chart@e2e.test',
      seed: true,
    });
    const { page } = member;
    const ledger = await readLedger(member);
    const lang = appLocale(locale);
    const current = monthOf(ledger.today);
    const closed = previousMonth(current);
    const title = (range: { end: string }) => upperFirst(formatMonthLong(range.end, lang));

    await page.goto('/stats');
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    const block = page.getByRole('region', { name: t('stats.expensesByPeriod') });
    // «Usual» is said in words under the chart.
    await expect(block).toContainText(
      t('stats.usualNote', { amount: 'X' }).split('X')[0]?.trim() ?? '',
    );

    // Six closed bars, then the running one, which is selected. Each bar is a link to its period.
    const bars = block.getByRole('link');
    await expect(bars.nth(6)).toHaveAttribute('aria-current', 'true');
    await bars.nth(5).click();
    await expect(page.getByText(title(closed), { exact: true })).toBeVisible();
    await expect(bars.nth(5)).toHaveAttribute('aria-current', 'true');
    await expect(block.locator('a[aria-current="true"]')).toHaveCount(1);

    // → goes back to the current month, ← to the previous one.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText(title(closed), { exact: true })).toBeVisible();
    await member.context.close();
  });
});
