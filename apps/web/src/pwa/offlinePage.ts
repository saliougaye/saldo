import type { AppLocale, Translate } from '@saldo/i18n';
import { tokensCss } from '@saldo/ui';

/** Text that goes into HTML: the catalogs hold plain text, so every `&<>"'` is escaped. */
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const PAGE_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:var(--layout-screen-padding-x);
background:var(--color-bg);color:var(--color-text);font-family:var(--font-family);
font-size:var(--font-size-body);line-height:1.4;-webkit-font-smoothing:antialiased}
main{max-width:360px;text-align:center;display:grid;gap:var(--layout-card-gap);justify-items:center}
img{width:96px;height:96px;border-radius:var(--radius-card)}
h1{margin:0;font-size:var(--font-size-title);font-weight:var(--font-weight-semibold)}
p{margin:0;color:var(--color-text-muted)}
a{margin-top:var(--layout-card-gap);padding:var(--layout-card-gap) var(--layout-card-padding);border-radius:var(--radius-button);background:var(--color-accent);
color:var(--color-on-accent);font-weight:var(--font-weight-medium);text-decoration:none}
a:focus-visible{outline:2px solid var(--color-text);outline-offset:2px}
`;

/**
 * What a navigation shows with no network. A whole document with its own style and no script, so
 * the service worker caches one response and nothing else is needed to draw it. «Riprova» is a link
 * to `/`, not a `reload()`: it works without script and lands where a person was heading.
 */
export function offlineHtml(locale: AppLocale, t: Translate): string {
  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(t('web.offline.title'))}</title>
<style>${tokensCss()}${PAGE_CSS}</style>
</head>
<body>
<main>
<img src="/icons/icon-192.png" alt="" width="96" height="96">
<h1>${escapeHtml(t('web.offline.title'))}</h1>
<p>${escapeHtml(t('web.offline.body'))}</p>
<a href="/">${escapeHtml(t('web.offline.retry'))}</a>
</main>
</body>
</html>
`;
}
