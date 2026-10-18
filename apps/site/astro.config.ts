import { defineConfig } from 'astro/config';
import { siteUrl } from './src/lib/siteUrl';

/**
 * Spec 0.8a §11: a static site. `site` is the public origin (D45): canonical and Open Graph URLs,
 * `robots.txt` and `sitemap.xml` read it through `Astro.site`.
 */
export default defineConfig({
  site: siteUrl(process.env),
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
});
