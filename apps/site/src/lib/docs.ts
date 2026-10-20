import type { SiteContent } from '../content/index';

/**
 * Spec 0.8b §02, §03 (D53): the Markdown files the docs library shows, in place. The content
 * loader, the link plugin and the sidebar read this list. A file is a path from the repository
 * root; its page is `/docs/<slug>/`.
 */
export const DOC_FILES = {
  'docs/self-hosting.md': 'self-hosting',
  'docs/building-android.md': 'building-android',
  'docs/building-ios.md': 'building-ios',
  'SECURITY.md': 'security',
  'CONTRIBUTING.md': 'contributing',
} as const;

export type DocFile = keyof typeof DOC_FILES;
export type DocSlug = (typeof DOC_FILES)[DocFile];

export const isDocFile = (path: string): path is DocFile => Object.hasOwn(DOC_FILES, path);

export const docPath = (slug: string) => `/docs/${slug}/`;

/** The Guide page renders from the app catalog, not from a file (spec 0.8b §05, D55). */
export const GUIDE_SLUG = 'guide';

/**
 * Spec 0.8b §02: the four groups of the sidebar and of `/docs/`, in order. The labels are site copy,
 * in `content/en.ts` under `docs.groups`.
 */
export const DOC_GROUPS = [
  { group: 'app', slugs: [GUIDE_SLUG] },
  { group: 'selfHost', slugs: ['self-hosting'] },
  { group: 'build', slugs: ['building-android', 'building-ios'] },
  { group: 'project', slugs: ['security', 'contributing'] },
] as const satisfies readonly {
  group: keyof SiteContent['docs']['groups'];
  slugs: readonly (DocSlug | typeof GUIDE_SLUG)[];
}[];
