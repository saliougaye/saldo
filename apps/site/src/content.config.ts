import { defineCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import { docsSchema } from '@astrojs/starlight/schema';
import { glob, type Loader } from 'astro/loaders';
import { DOC_FILES, isDocFile } from './lib/docs';
import { editUrl } from './lib/links';

/**
 * Spec 0.8b §03 (D53): the `docs` collection reads the Markdown files of `lib/docs.ts` where they
 * are, from the repository root. The files have no frontmatter (GitHub shows it as a table), so the
 * wrapper gives Starlight the title from the first `#` heading, and the GitHub edit link.
 */
const files = glob({
  base: '../..',
  pattern: Object.keys(DOC_FILES),
  generateId: ({ entry }) => (isDocFile(entry) ? `docs/${DOC_FILES[entry]}` : entry),
});

const repoMarkdown: Loader = {
  name: 'saldo-repo-markdown',
  load: (context) =>
    files.load({
      ...context,
      parseData: async (props) => {
        const file = new URL(props.filePath ?? '', context.config.root);
        const path = Object.keys(DOC_FILES).find((each) => file.pathname.endsWith(`/${each}`));
        // Skip fenced code first: a shell comment such as `# macOS` is not the title.
        const text = (await readFile(file, 'utf8')).replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
        const title = /^# (.+)$/m.exec(text)?.[1]?.trim();
        if (!path || !title) throw new Error(`${file}: not in lib/docs.ts, or no "# " heading.`);
        return context.parseData({
          ...props,
          data: { ...props.data, title, editUrl: editUrl(path) },
        });
      },
    }),
};

export const collections = {
  docs: defineCollection({ loader: repoMarkdown, schema: docsSchema() }),
};
