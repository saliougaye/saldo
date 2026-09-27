import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A colour typed by hand: a hex value where a value can start (so an `#id` selector or a `url(#ref)`
 * is not one), or a colour function. Case-insensitive, as CSS is.
 */
const COLOUR = /(?<=[:\s,])#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
/** A declaration whose value must come from a token: font sizes (shorthand included) and radii. */
const SIZED = /\b(font-size|font|border(?:-[a-z]+)*-radius)\s*:\s*([^;}]*)/gi;
/** A length or computed size, once every plain `var(--token)` has been taken out of the value. */
const LENGTH = /\d(?:px|r?em|pt|%)|calc\(/i;
/** A token with no fallback; one with a fallback keeps its literal, which is what is refused. */
const PLAIN_VAR = /var\(--[\w-]+\)/g;

/**
 * §17.1.7: every colour, font size and radius comes from a token variable. Returns what it found
 * typed by hand, in order; comments are skipped so a note may still mention an old value (the
 * stripping does not know about strings, so a `content: "/*"` would confuse it).
 */
export function findHardCodedValues(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found: { at: number; text: string }[] = [];
  for (const match of code.matchAll(COLOUR)) found.push({ at: match.index, text: match[0] });
  for (const match of code.matchAll(SIZED)) {
    const property = (match[1] ?? '').toLowerCase();
    const value = (match[2] ?? '').trim();
    if (LENGTH.test(value.replace(PLAIN_VAR, ''))) {
      found.push({ at: match.index, text: `${property}: ${value}` });
    }
  }
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.text);
}

const ROOT = join(import.meta.dirname, '..', '..');
const SEARCHED = ['app', 'src'];

/**
 * Every stylesheet of the web app, with its path from `apps/web`. All `.css`, not only CSS Modules:
 * a global sheet must take its values from the tokens too. Inline `style={{}}` in components is not
 * scanned; review keeps it out.
 */
export function moduleCssFiles(): { path: string; css: string }[] {
  return SEARCHED.flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.css'))
      .map((file) => {
        const full = join(ROOT, dir, file);
        return { path: relative(ROOT, full), css: readFileSync(full, 'utf8') };
      }),
  );
}
