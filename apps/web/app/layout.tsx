import { readSettings } from '@saldo/core';
import { tokensCss } from '@saldo/ui';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { publicI18n } from '../src/i18n/server';
import { currentUser } from '../src/server/auth/currentUser';
import { loadUserData } from '../src/server/userData/load';
import './globals.css';

export const metadata = {
  title: 'Saldo',
  description: 'Saldo',
};

/**
 * Built once per process: the tokens do not change while the server runs. The line after them points
 * `--font-family` at the font package's own variable — same specificity, later rule, so it wins
 * without an inline style and without `@saldo/ui` having to know how the web loads a font.
 */
const TOKENS = `${tokensCss()}

:root {
  --font-family: var(--font-geist-sans), "Inter Tight", ui-sans-serif, system-ui, sans-serif;
}`;

/**
 * The forced theme, or `undefined` for `system` and for nobody signed in. It belongs on `<html>`
 * rather than on the shell's own wrapper: a portal (Base UI's menus, and the panels and dialogs of
 * Tasks 14 and 20) mounts on `document.body`, outside any wrapper, and would otherwise render in
 * the opposite palette to the page behind it. `currentUser` and `loadUserData` are both `cache()`d,
 * so reading them here costs the `(app)` layout nothing.
 */
async function forcedTheme(): Promise<'dark' | 'light' | undefined> {
  const user = await currentUser();
  if (user === null) return undefined;
  const { theme } = readSettings((await loadUserData(user.id)).settings);
  return theme === 'system' ? undefined : theme;
}

/**
 * `lang` is the locale the page renders in, which a screen reader and the browser's own hyphenation
 * both read. `data-theme` is the user's `settings.theme`; `system` sets no attribute and leaves
 * `prefers-color-scheme` to decide, which is what `tokensCss()` writes.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [{ locale }, theme] = await Promise.all([publicI18n(), forcedTheme()]);
  return (
    <html lang={locale} className={GeistSans.variable} data-theme={theme}>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant built from tokens.ts, never user input; React would entity-escape the quotes in the selectors and font stack if it were a text child. */}
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
