import { defineConfig } from 'astro/config';

const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

/**
 * Spec 0.8a §11: a static site. `site` is the public origin (D45): canonical and Open Graph URLs,
 * `robots.txt` and `sitemap.xml` read it through `Astro.site`. It is `SITE_URL`; on Vercel, the
 * production host that Vercel names; anywhere else, the dev server. No domain is in the code.
 */
export default defineConfig({
  site: process.env.SITE_URL?.trim() || (vercel ? `https://${vercel}` : 'http://localhost:4321'),
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
});
