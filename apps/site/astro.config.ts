import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { en } from './src/content/en';
import { appText } from './src/lib/appText';
import { DOC_GROUPS, docPath, GUIDE_SLUG } from './src/lib/docs';
import { REPO_URL } from './src/lib/links';
import { repoLinks } from './src/lib/repoLinks';

const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

/**
 * Spec 0.8a §11: a static site. `site` is the public origin (D45): canonical and Open Graph URLs,
 * `robots.txt` and the sitemap read it through `Astro.site`. It is `SITE_URL`; on Vercel, the
 * production host that Vercel names; anywhere else, the dev server. No domain is in the code.
 *
 * Spec 0.8b: Starlight serves the docs library under `/docs/` (D53). The Markdown link plugin
 * (D54) needs the repository root. `prefetch: false` keeps Starlight's prefetch script off the
 * landing page (D58).
 */
export default defineConfig({
  site: process.env.SITE_URL?.trim() || (vercel ? `https://${vercel}` : 'http://localhost:4321'),
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
  prefetch: false,
  markdown: {
    processor: satteri({ mdastPlugins: [repoLinks(new URL('../../', import.meta.url))] }),
  },
  integrations: [
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/og/') }),
    starlight({
      title: 'Saldo',
      description: en.docs.description,
      favicon: '/favicon.png',
      social: [{ icon: 'github', label: 'GitHub', href: REPO_URL }],
      customCss: [
        '@fontsource/geist-sans/latin-400.css',
        '@fontsource/geist-sans/latin-500.css',
        '@fontsource/geist-sans/latin-600.css',
        '@fontsource/geist-mono/latin-400.css',
        './src/styles/docs.css',
      ],
      components: {
        Head: './src/components/docs/Head.astro',
        SiteTitle: './src/components/docs/SiteTitle.astro',
        ThemeProvider: './src/components/docs/ThemeProvider.astro',
        ThemeSelect: './src/components/docs/ThemeSelect.astro',
      },
      sidebar: DOC_GROUPS.map(({ group, slugs }) => ({
        label: en.docs.groups[group].label,
        items: slugs.map((slug) =>
          slug === GUIDE_SLUG
            ? { label: appText('en', 'guide.title'), link: docPath(slug) }
            : `docs/${slug}`,
        ),
      })),
      expressiveCode: {
        styleOverrides: {
          borderRadius: 'var(--radius-card)',
          borderColor: 'var(--color-border)',
          codeBackground: 'var(--color-surface)',
        },
      },
    }),
  ],
});
