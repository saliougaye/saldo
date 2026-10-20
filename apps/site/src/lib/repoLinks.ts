import { posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';
import { DOC_FILES, docPath, isDocFile } from './docs';
import { blobUrl } from './links';

type MdastPluginEntry = NonNullable<SatteriProcessorOptions['mdastPlugins']>[number];

/** A relative link to a Markdown file, with an optional anchor: `./self-hosting.md#configuration`. */
const MD_LINK = /^([^#?:]+\.md)(#.*)?$/;

/**
 * Spec 0.8b §04 (D54): the Markdown files keep relative links, so they work on GitHub. On the
 * site, a link to a file of the library goes to its page, and a link to any other file goes to
 * GitHub. The first `#` heading goes too: Starlight shows the title as the page `h1`.
 *
 * `root` is the repository root as a file URL. The plugin leaves every other Markdown file alone.
 */
export const repoLinks =
  (root: URL): MdastPluginEntry =>
  ({ fileURL }) => {
    if (!fileURL) return null;
    const from = relative(fileURLToPath(root), fileURLToPath(fileURL)).split(sep).join('/');
    if (!isDocFile(from)) return null;
    return {
      name: 'saldo-repo-links',
      heading(node, ctx) {
        if (node.depth === 1) ctx.removeNode(node);
      },
      link(node, ctx) {
        const match = MD_LINK.exec(node.url);
        if (!match?.[1]) return;
        const target = posix.normalize(posix.join(posix.dirname(from), match[1]));
        const anchor = match[2] ?? '';
        const url = isDocFile(target) ? docPath(DOC_FILES[target]) : blobUrl(target);
        ctx.setProperty(node, 'url', `${url}${anchor}`);
      },
    };
  };
