// Spec 0.8a §09: renders /og/ of the built site to public/og.png (1200 × 630).
// Run `pnpm --filter site build` first; then `pnpm --filter site og`; commit public/og.png.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const preview = spawn('pnpm', ['exec', 'astro', 'preview', '--port', '4399', '--ignore-lock'], {
  cwd: root,
  stdio: 'pipe',
});
// Astro moves to the next free port when 4399 is busy, so read the address that it prints.
// `--ignore-lock` keeps the server in the foreground when an agent runs this script.
const origin = await new Promise((resolve, reject) => {
  preview.stdout.on('data', (chunk) => {
    const match = /http:\/\/localhost:\d+/.exec(String(chunk));
    if (match) resolve(match[0]);
  });
  preview.on('exit', (code) => reject(new Error(`astro preview exited with ${code}`)));
});
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    colorScheme: 'dark',
  });
  await page.goto(`${origin}/og/`, { waitUntil: 'networkidle' });
  await page.locator('.og').screenshot({ path: `${root}public/og.png` });
  await browser.close();
} finally {
  preview.kill();
}
