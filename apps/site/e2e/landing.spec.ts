import { expect, type Page, test } from '@playwright/test';

const REPO = 'https://github.com/saliougaye/saldo';
const GUIDE = 'https://github.com/saliougaye/saldo/blob/main/docs/self-hosting.md';

/** Where the scroller rests, and whether that is one of its stops (spec 0.8a §05). */
async function carousel(page: Page) {
  return page.locator('[data-carousel-scroller]').evaluate((scroller: HTMLElement) => {
    const pad = Number.parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart) || 0;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const stops = Array.from(scroller.querySelectorAll<HTMLElement>('.car-it')).map((item) => {
      const stop = Math.max(0, Math.min(max, item.offsetLeft - pad));
      return Math.round(stop > max - 32 ? max : stop);
    });
    const x = scroller.scrollLeft;
    return { x, max, onStop: stops.some((stop) => Math.abs(stop - x) <= 1) };
  });
}

async function settle(page: Page) {
  await page.waitForFunction(
    () => !document.querySelector('[data-carousel-scroller]')?.classList.contains('anim'),
  );
}

test.describe('landing page', () => {
  let errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/');
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test('has no horizontal overflow and only the two calls to action', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const hrefs = await page
      .locator('a.btn-primary, a.btn-ghost')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(new Set(hrefs)).toEqual(new Set([REPO, GUIDE]));
  });

  test('shows ten screens and names each one', async ({ page }) => {
    const labels = await page
      .locator('[data-carousel-track] .ph[role="img"]')
      .evaluateAll((screens) => screens.map((screen) => screen.getAttribute('aria-label') ?? ''));
    expect(labels).toHaveLength(10);
    for (const label of labels) expect(label).toMatch(/^[A-Z][\w ]+: /);
  });

  test('buttons and keys stop on a card, and each button is disabled at its end', async ({
    page,
  }) => {
    const next = page.locator('[data-carousel-next]');
    const prev = page.locator('[data-carousel-prev]');
    await expect(prev).toBeDisabled();
    while (!(await next.isDisabled())) {
      await next.click();
      await settle(page);
      expect((await carousel(page)).onStop).toBe(true);
    }
    await expect(page.locator('[data-carousel-count]')).toHaveText('10 / 10');
    await page.locator('[data-carousel-scroller]').focus();
    await page.keyboard.press('Home');
    await settle(page);
    expect((await carousel(page)).x).toBe(0);
    await page.keyboard.press('ArrowRight');
    await settle(page);
    const after = await carousel(page);
    expect(after.onStop).toBe(true);
    expect(after.x).toBeGreaterThan(0);
  });

  test('a mouse flick lands on a card and does not scroll the page', async ({ page }) => {
    const scroller = page.locator('[data-carousel-scroller]');
    await scroller.scrollIntoViewIfNeeded();
    const box = await scroller.boundingBox();
    if (box === null) throw new Error('the carousel has no box');
    const pageY = await page.evaluate(() => window.scrollY);
    const y = box.y + 200;
    await page.mouse.move(box.x + box.width * 0.6, y);
    await page.mouse.down();
    for (let step = 1; step <= 6; step += 1) {
      await page.mouse.move(box.x + box.width * 0.6 - step * 60, y);
    }
    await page.mouse.up();
    await settle(page);
    const state = await carousel(page);
    expect(state.onStop).toBe(true);
    expect(state.x).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageY);
  });

  test('the theme toggle sets the theme before the next paint, after a reload too', async ({
    page,
  }) => {
    const toggle = page.locator('[data-theme-toggle]');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await toggle.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });
});
