import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g;
const SIZE = /\b(?:font-size|border(?:-[a-z]+)*-radius)\s*:\s*[\d.]+(?:px|rem|em)\b/g;

/**
 * §17.1.7: every colour, font size and radius comes from a token variable. Returns what it found
 * typed by hand, in order; comments are skipped so a note may still mention an old value.
 */
export function findHardCodedValues(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...code.matchAll(COLOUR), ...code.matchAll(SIZE)]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((match) => match[0]);
}

const ROOT = join(import.meta.dirname, '..', '..');
const SEARCHED = ['app', 'src'];

/** Every `.module.css` of the web app, with its path from `apps/web`. */
export function moduleCssFiles(): { path: string; css: string }[] {
  return SEARCHED.flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.module.css'))
      .map((file) => {
        const full = join(ROOT, dir, file);
        return { path: relative(ROOT, full), css: readFileSync(full, 'utf8') };
      }),
  );
}
