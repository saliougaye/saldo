import {
  categoryColors,
  fontFamily,
  fontSize,
  fontWeight,
  layout,
  motion,
  type Palette,
  palettes,
  radii,
  tracking,
} from './tokens';

/** `textMuted` → `text-muted`: token names as CSS custom property names. */
export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * The browser's default root size. Font sizes are written in rem so a user's text-size setting
 * scales them; every size in `fontSize` divides into an exact binary fraction, so nothing rounds.
 */
const ROOT_FONT_PX = 16;

function paletteDeclarations(palette: Palette): string[] {
  const lines: string[] = [];
  // Typed keys, not `Object.entries`: an interface has no index signature, so entries would be `any`.
  for (const name of Object.keys(palette) as (keyof Palette)[]) {
    const value = palette[name];
    if (typeof value === 'string') {
      lines.push(`--color-${kebab(name)}: ${value};`);
    } else {
      value.forEach((entry, index) => {
        lines.push(`--color-${kebab(name)}-${index}: ${entry};`);
      });
    }
  }
  return lines;
}

/** Durations (`pressMs` → `--motion-press: 120ms`) and curves; scales and offsets stay in TS. */
function motionDeclarations(): string[] {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(motion)) {
    if (typeof value === 'number') {
      if (name.endsWith('Ms')) lines.push(`--motion-${kebab(name.slice(0, -2))}: ${value}ms;`);
    } else {
      lines.push(`--motion-${kebab(name)}: cubic-bezier(${value.join(', ')});`);
    }
  }
  return lines;
}

/** Everything that does not change with the theme. */
function sharedDeclarations(): string[] {
  return [
    `--font-family: ${fontFamily.primary}, "${fontFamily.fallback}", ui-sans-serif, system-ui, sans-serif;`,
    ...Object.entries(fontSize).map(
      ([name, px]) => `--font-size-${kebab(name)}: ${px / ROOT_FONT_PX}rem;`,
    ),
    ...Object.entries(fontWeight).map(
      ([name, weight]) => `--font-weight-${kebab(name)}: ${weight};`,
    ),
    ...Object.entries(tracking).map(([name, em]) => `--tracking-${kebab(name)}: ${em}em;`),
    ...Object.entries(radii).map(([name, px]) => `--radius-${kebab(name)}: ${px}px;`),
    ...Object.entries(layout).map(([name, px]) => `--layout-${kebab(name)}: ${px}px;`),
    ...motionDeclarations(),
    ...categoryColors.map((colour, index) => `--category-${index}: ${colour};`),
  ];
}

function block(selector: string, lines: readonly string[], indent = ''): string {
  const body = lines.map((line) => `${indent}  ${line}`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}`;
}

/**
 * The tokens as CSS custom properties (§17.1.7). Dark is the default, as on the phone; `system`
 * follows `prefers-color-scheme` unless the page says `data-theme="dark"`, and either theme can be
 * forced with `data-theme`. The web's root layout injects this string, so there is no generated
 * file to fall out of step with `tokens.ts`; the accent the user picks overrides `--color-accent`
 * and `--color-on-accent` on `<html>` in whichever step adds it.
 *
 * Both forced themes are **attribute selectors**, so any element carries them — the web's signed-in
 * shell is a `<div>` inside a root layout it cannot touch, and it sets the theme there. `:root`
 * alone would not do for dark: on a browser that prefers light, the `prefers-color-scheme` block
 * has already repainted `:root`, and a nested element needs a rule of its own to take it back.
 */
export function tokensCss(): string {
  const light = ['color-scheme: light;', ...paletteDeclarations(palettes.light)];
  const dark = ['color-scheme: dark;', ...paletteDeclarations(palettes.dark)];
  return [
    block(':root', [...dark, ...sharedDeclarations()]),
    `@media (prefers-color-scheme: light) {\n${block(':root:not([data-theme="dark"])', light, '  ')}\n}`,
    // After the media block, so a forced theme wins wherever it is carried.
    block('[data-theme="dark"]', dark),
    block('[data-theme="light"]', light),
  ].join('\n\n');
}
