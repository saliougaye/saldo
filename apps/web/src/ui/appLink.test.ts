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
const ALLOWED = ['/src/ui/AppLink.tsx', '/src/ui/NavPending.tsx'];

/** A link that skips `AppLink` never shows the bar. */
describe('links', () => {
  it('import next/link only in AppLink', () => {
    const offenders = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'src'))].filter(
      (path) =>
        !ALLOWED.some((allowed) => path.endsWith(allowed)) &&
        /from 'next\/link'/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
