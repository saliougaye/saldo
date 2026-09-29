import { describe, expect, it } from 'vitest';
import { kebab, tokensCss } from './css';
import { categoryColors, fontSize, palettes, radii, withAlpha } from './tokens';

/** The declarations inside the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no block for ${selector}`);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('kebab', () => {
  it('turns camelCase token names into CSS names', () => {
    expect(kebab('textMuted')).toBe('text-muted');
    expect(kebab('amountXl')).toBe('amount-xl');
    expect(kebab('surface')).toBe('surface');
  });
});

describe('tokensCss', () => {
  const css = tokensCss();

  it('declares the dark palette on :root, which is the default theme', () => {
    const root = block(css, ':root');
    expect(root).toContain('color-scheme: dark;');
    expect(root).toContain(`--color-surface: ${palettes.dark.surface};`);
    expect(root).toContain(`--color-text-muted: ${palettes.dark.textMuted};`);
    expect(root).toContain(`--color-border-strong: ${palettes.dark.borderStrong};`);
  });

  it('declares the light palette for data-theme="light"', () => {
    const light = block(css, '[data-theme="light"]');
    expect(light).toContain('color-scheme: light;');
    expect(light).toContain(`--color-surface: ${palettes.light.surface};`);
    expect(light).toContain(`--color-text: ${palettes.light.text};`);
  });

  it('declares the dark palette for data-theme="dark", so any element can force it', () => {
    const dark = block(css, '[data-theme="dark"]');
    expect(dark).toContain('color-scheme: dark;');
    expect(dark).toContain(`--color-surface: ${palettes.dark.surface};`);
    expect(dark).toContain(`--color-text: ${palettes.dark.text};`);
    expect(dark).toContain(`--color-heatmap-0: ${palettes.dark.heatmap[0]};`);
  });

  it('forces dark with the same declarations :root uses, minus what does not change', () => {
    const forced = block(css, '[data-theme="dark"]')
      .split('\n')
      .slice(1)
      .map((line) => line.trim());
    const root = block(css, ':root');
    for (const line of forced) expect(root).toContain(line);
    // Only the palette: the sizes and durations are declared once, on `:root`.
    expect(forced).not.toContain('--font-size-body: 0.9375rem;');
  });

  it('puts forced dark after the system block, so a nested element can take light back', () => {
    // A browser that prefers light has already repainted `:root`; a rule that comes earlier, or
    // that only matches `:root`, would leave `<div data-theme="dark">` light.
    expect(css.indexOf('[data-theme="dark"] {')).toBeGreaterThan(
      css.indexOf('@media (prefers-color-scheme: light)'),
    );
  });

  it('follows the system in light mode unless the user chose dark', () => {
    expect(css).toContain('@media (prefers-color-scheme: light)');
    const system = block(css, ':root:not([data-theme="dark"])');
    expect(system).toContain(`--color-bg: ${palettes.light.bg};`);
  });

  it('puts forced light after the dark default, and gives system light the same values', () => {
    // Same specificity as `:root`: forced light wins only because it comes later.
    expect(css.indexOf('[data-theme="light"] {')).toBeGreaterThan(css.indexOf(':root {'));
    const forced = block(css, '[data-theme="light"]')
      .split('\n')
      .slice(1)
      .map((line) => line.trim());
    const system = block(css, ':root:not([data-theme="dark"])')
      .split('\n')
      .slice(1)
      .map((line) => line.trim());
    expect(system).toEqual(forced);
    expect(forced).toContain(`--color-heatmap-0: ${palettes.light.heatmap[0]};`);
  });

  it('numbers the entries of a palette array', () => {
    const root = block(css, ':root');
    palettes.dark.heatmap.forEach((colour, index) => {
      expect(root).toContain(`--color-heatmap-${index}: ${colour};`);
    });
    expect(root).toContain(`--color-segments-4: ${palettes.dark.segments[4]};`);
  });

  it('writes font sizes in rem so the browser text size scales them', () => {
    const root = block(css, ':root');
    expect(root).toContain(`--font-size-body: ${fontSize.body / 16}rem;`);
    expect(root).toContain('--font-size-hero: 2.75rem;');
  });

  it('writes radii, layout and tracking with their units', () => {
    const root = block(css, ':root');
    expect(root).toContain(`--radius-card: ${radii.card}px;`);
    expect(root).toContain('--radius-pill: 999px;');
    expect(root).toContain('--layout-card-padding: 16px;');
    expect(root).toContain('--tracking-tighter: -0.02em;');
  });

  it('writes motion durations and curves, and nothing else from motion', () => {
    const root = block(css, ':root');
    expect(root).toContain('--motion-press: 120ms;');
    expect(root).toContain('--motion-sheet: 280ms;');
    expect(root).toContain('--motion-easing: cubic-bezier(0.32, 0.72, 0, 1);');
    expect(root).toContain('--motion-swap-easing: cubic-bezier(0.2, 0, 0, 1);');
    expect(root).not.toContain('--motion-swap-from-scale');
  });

  it('declares every category colour by the index entities store, with its tint', () => {
    const root = block(css, ':root');
    categoryColors.forEach((colour, index) => {
      expect(root).toContain(`--category-${index}: ${colour};`);
      // The alpha the phone tints an icon box with, so the two renderers cannot drift apart.
      expect(root).toContain(`--category-${index}-tint: ${withAlpha(colour, 0.14)};`);
    });
  });

  it('declares the font stack and the weights', () => {
    const root = block(css, ':root');
    expect(root).toContain(
      '--font-family: Geist, "Inter Tight", ui-sans-serif, system-ui, sans-serif;',
    );
    expect(root).toContain('--font-weight-semibold: 600;');
  });

  it('writes the web layout decided in the design pass (§17.1.7)', () => {
    const root = block(css, ':root');
    for (const line of [
      '--layout-topbar-height: 64px;',
      '--layout-content-wide: 1120px;',
      '--layout-page-padding-web: 48px;',
      '--layout-nav-item-height: 36px;',
      '--layout-section-gap-web: 56px;',
      '--layout-column-gap-web: 72px;',
      '--layout-panel-width: 420px;',
      '--layout-search-width: 320px;',
      '--layout-subnav-width: 200px;',
      '--layout-auth-width: 380px;',
      '--layout-dialog-width: 400px;',
      '--layout-wide-breakpoint: 1024px;',
      '--font-size-hero-web: 3.5rem;',
    ]) {
      expect(root).toContain(line);
    }
  });

  it('never prints a value that did not resolve', () => {
    expect(css).not.toMatch(/undefined|NaN|\[object/);
  });
});
