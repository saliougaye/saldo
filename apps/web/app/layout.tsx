import { tokensCss } from '@saldo/ui';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Saldo',
  description: 'Self-hosted Saldo server',
};

/** Built once per process: the tokens do not change while the server runs. */
const TOKENS = tokensCss();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant built from tokens.ts, never user input; React would entity-escape the quotes in the selectors and font stack if it were a text child. */}
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {children}
      </body>
    </html>
  );
}
