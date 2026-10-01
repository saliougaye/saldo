import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

describe('the app policy', () => {
  it('lets the page register its own service worker and read its own manifest', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    // `/sw.js` and `/manifest.webmanifest` both match the catch-all that excludes only `/api/`.
    const rule = rules.find((entry) => entry.source === '/((?!api/).*)');
    const csp = rule?.headers.find((header) => header.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).not.toMatch(/worker-src[^;]*\*/);
  });
});
