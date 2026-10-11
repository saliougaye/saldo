import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

/**
 * `AppLink` renders `next/link`. `NavPending` imports `useLinkStatus` from it: that hook must be in a
 * client file, and `AppLink` is not one.
 */
const APP_LINK = '/src/ui/AppLink.tsx';
const NAV_PENDING = '/src/ui/NavPending.tsx';

/** The import clauses of every `import … from 'next/link'` in `text`. */
function nextLinkImports(text: string): string[] {
  return [...text.matchAll(/import\s+([^;]*?)\s+from 'next\/link'/g)].map((match) =>
    (match[1] ?? '').replace(/\s+/g, ' '),
  );
}

/** A link that skips `AppLink` never shows the bar. */
describe('links', () => {
  it('import next/link only in AppLink and NavPending', () => {
    const offenders = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'src'))].filter(
      (path) =>
        !path.endsWith(APP_LINK) &&
        !path.endsWith(NAV_PENDING) &&
        /from 'next\/link'/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('take only useLinkStatus from next/link in NavPending', () => {
    const text = readFileSync(join(ROOT, NAV_PENDING), 'utf8');
    expect(nextLinkImports(text)).toEqual(['{ useLinkStatus }']);
  });
});
