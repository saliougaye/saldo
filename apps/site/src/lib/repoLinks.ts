import { readFileSync } from 'node:fs';
import { posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SatteriProcessorOptions } from '@astrojs/markdown-satteri';
import { DOC_FILES, docPath, isDocFile } from './docs';
import { blobUrl } from './links';

type MdastPluginEntry = NonNullable<SatteriProcessorOptions['mdastPlugins']>[number];

/**
 * A relative link to a file, with an optional query or anchor: `./self-hosting.md#configuration`,
 * `../LICENSE`. Not a URL with a scheme, not an anchor alone, not a root-relative path.
 */
const RELATIVE_LINK = /^(?![a-z][a-z0-9+.-]*:|[#/])([^?#]+)([?#].*)?$/i;

/**
 * A diagram is an SVG file next to the guide, alone in its paragraph: `![Caption](diagrams/x.svg)`.
 * GitHub shows the file as an image, and the `<style>` inside it picks light or dark from the
 * system. The site puts the SVG inline without that `<style>`, so `styles/docs.css` colours it with
 * the tokens of the theme the reader chose.
 */
const diagram = (file: URL, caption: string) => {
  const svg = readFileSync(file, 'utf8')
    .replace(/<\?xml[^>]*>\s*/, '')
    .replace(/\s*<style>[\s\S]*?<\/style>/, '')
    .trim();
  const escaped = caption.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<figure class="docs-figure"><div class="docs-figure-scroll">${svg}</div><figcaption>${escaped}</figcaption></figure>`;
};

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
      paragraph(node, ctx) {
        const [only, ...rest] = node.children;
        if (rest.length > 0 || only?.type !== 'image' || !only.url.endsWith('.svg')) return;
        const match = RELATIVE_LINK.exec(only.url);
        if (!match?.[1]) return;
        const file = new URL(posix.join(posix.dirname(from), match[1]), root);
        ctx.replaceNode(node, { type: 'html', value: diagram(file, only.alt ?? '') });
      },
      link(node, ctx) {
        const match = RELATIVE_LINK.exec(node.url);
        if (!match?.[1]) return;
        const target = posix.normalize(posix.join(posix.dirname(from), match[1]));
        const rest = match[2] ?? '';
        const url = isDocFile(target) ? docPath(DOC_FILES[target]) : blobUrl(target);
        ctx.setProperty(node, 'url', `${url}${rest}`);
      },
    };
  };
