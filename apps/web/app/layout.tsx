import { tokensCss } from '@saldo/ui';
import { GeistSans } from 'geist/font/sans';
import type { ReactNode } from 'react';
import { publicI18n } from '../src/i18n/server';
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
 * `lang` is the locale the page renders in, which a screen reader and the browser's own hyphenation
 * both read. The theme is the user's `settings.theme` from 0.3d on; until then `system` applies,
 * which is what `tokensCss()` already writes as a `prefers-color-scheme` block.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await publicI18n();
  return (
    <html lang={locale} className={GeistSans.variable}>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant built from tokens.ts, never user input; React would entity-escape the quotes in the selectors and font stack if it were a text child. */}
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
