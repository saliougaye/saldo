import { readSettings } from '@saldo/core';
import type { AppLocale } from '@saldo/i18n';
import { palettes, tokensCss } from '@saldo/ui';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { publicI18n, userI18n } from '../src/i18n/server';
import { RegisterServiceWorker } from '../src/pwa/RegisterServiceWorker';
import { currentUser } from '../src/server/auth/currentUser';
import { loadUserData } from '../src/server/userData/load';
import './globals.css';

export const metadata: Metadata = {
  title: 'Saldo',
  description: 'Saldo',
  // §17.1.7: opened from the home screen it runs full-screen, under its own name.
  appleWebApp: { capable: true, title: 'Saldo', statusBarStyle: 'default' },
};

/** The browser's title bar follows the system scheme, as `tokensCss()` does when no theme is chosen. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: palettes.light.bg },
    { media: '(prefers-color-scheme: dark)', color: palettes.dark.bg },
  ],
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

interface DocumentAttributes {
  /** §17.1.6: the synced `settings.language` where there is a session, `Accept-Language` where not. */
  locale: AppLocale;
  /** `undefined` for `system`, which leaves `prefers-color-scheme` to decide. */
  theme: 'dark' | 'light' | undefined;
}

/**
 * What `<html>` carries. The theme belongs here rather than on the shell's own wrapper: a portal
 * (Base UI's menus, and the panels and dialogs of Tasks 14 and 20) mounts on `document.body`,
 * outside any wrapper, and would otherwise render in the opposite palette to the page behind it.
 * The locale belongs here because `lang` is the whole document's, and a page whose text is Italian
 * must not tell a screen reader it is English.
 *
 * `currentUser` and `loadUserData` are both `cache()`d, and `userI18n` reads the same load, so a
 * signed-in request answers both of these without a query the `(app)` layout was not making anyway.
 * This decides the two attributes only: the pages and the `(app)` layout call `userI18n` for their
 * own strings, and share it through the same cache.
 */
async function documentAttributes(): Promise<DocumentAttributes> {
  const user = await currentUser();
  if (user === null) return { locale: (await publicI18n()).locale, theme: undefined };
  const [{ locale }, data] = await Promise.all([userI18n(user.id), loadUserData(user.id)]);
  const { theme } = readSettings(data.settings);
  return { locale, theme: theme === 'system' ? undefined : theme };
}

/**
 * `lang` is the locale the page renders in, which a screen reader and the browser's own hyphenation
 * both read. `data-theme` is the user's `settings.theme`; `system` sets no attribute and leaves
 * `prefers-color-scheme` to decide, which is what `tokensCss()` writes.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, theme } = await documentAttributes();
  return (
    <html lang={locale} className={GeistSans.variable} data-theme={theme}>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant built from tokens.ts, never user input; React would entity-escape the quotes in the selectors and font stack if it were a text child. */}
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      </head>
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
