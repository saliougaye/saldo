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
      .sort((a, b) => b.date.localeCompare(a.date));
    expect(ahead.length).toBeGreaterThanOrEqual(2);
    const upcoming = sectionOf(page, t('home.upcoming'));
    await expect(upcoming).toContainText(plural(t, lang, 'home.upcomingCount', ahead.length));
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
    const recent = sectionOf(page, t('home.recent'));
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

    await recent.getByRole('link', { name: t('home.allTransactions') }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await member.context.close();
  });

  test('the budgets and the goals carry the seeded figures, and one of each is featured', async ({
    browser,
    t,
    locale,
  }) => {
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
    let featuredBudgets = 0;
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
      featuredBudgets += await page
        .getByText(ofLine(budget.amount, spentSoFar), { exact: true })
        .count();
    }
    // The card lifts one budget into view, with its bar and its advice; the others are rows.
    expect(featuredBudgets).toBe(1);

    // Goals: a pocket's balance is the transfers into it.
    const goals = ledger.accounts.filter((account) => account.type === 'pocket');
    expect(goals).toHaveLength(2);
    let featuredGoals = 0;
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
      featuredGoals += await page.getByText(ofLine(target, put), { exact: true }).count();
    }
    expect(featuredGoals).toBe(1);
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

    await next.click();
    await next.click();
    await expect(page.getByText(title(current), { exact: true })).toBeVisible();
    await expect(next).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]p=/);
    await member.context.close();
  });
});

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
    // The figures above the split agree with it.
    await expect(statFigure(page, t('stats.expenses'))).toContainText(money(expenses.total));
    await expect(section).toContainText(money(expenses.total));
    for (const { name, amount } of expenses.ranked) {
      const row = rowOf(section, name);
      await expect(row).toContainText(money(amount));
      await expect(row).toContainText(
        t('stats.ofTotal', { pct: percentOf(amount, expenses.total) }),
      );
    }
    // Biggest first.
    const first = expenses.ranked[0];
    await expect(rowOf(section, first?.name ?? '')).toBeVisible();
    const order = await section
      .locator('[class*="ListRow"][class*="title"]:not([class*="subtitle"])')
      .allTextContents();
    expect(order).toEqual(expenses.ranked.map((row) => row.name));

    // The same month read as income.
    await section.getByRole('link', { name: t('stats.income') }).click();
    await expect(page).toHaveURL(/direction=income/);
    for (const { name, amount } of income.ranked) {
      await expect(rowOf(sectionOf(page, t('stats.split')), name)).toContainText(money(amount));
    }
    await expect(sectionOf(page, t('stats.split'))).toContainText(money(income.total));

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
});
