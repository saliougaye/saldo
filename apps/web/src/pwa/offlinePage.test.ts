import { catalogs, makeTranslator } from '@saldo/i18n';
import { describe, expect, it } from 'vitest';
import { offlineHtml } from './offlinePage';

describe('offlineHtml', () => {
  it('needs no script and no asset but the cached icon', () => {
    const html = offlineHtml('en', makeTranslator(catalogs.en));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
    expect([...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1])).toEqual(['/icons/icon-192.png']);
  });

  it('escapes what the catalog says', () => {
    const t = () => `<b>"Saldo" & 'co'`;
    const html = offlineHtml('en', t);
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;&quot;Saldo&quot; &amp; &#39;co&#39;');
  });
});
