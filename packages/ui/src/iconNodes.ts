export type IconTag = 'path' | 'circle' | 'rect';

export interface IconNode {
  tag: IconTag;
  /** SVG attributes with camelCase names (`stroke-width` → `strokeWidth`). */
  attrs: Record<string, string>;
}

const ELEMENT_RE = /<(path|circle|rect)\b([^>]*?)\/>/g;
const ATTRIBUTE_RE = /([a-zA-Z-]+)="([^"]*)"/g;

function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Parses the self-closing SVG snippets used by the design icon set. */
export function parseIconMarkup(markup: string): IconNode[] {
  const nodes: IconNode[] = [];
  for (const element of markup.matchAll(ELEMENT_RE)) {
    const attrs: Record<string, string> = {};
    for (const attribute of (element[2] ?? '').matchAll(ATTRIBUTE_RE)) {
      const [, name, value] = attribute;
      if (name !== undefined && value !== undefined) attrs[toCamelCase(name)] = value;
    }
    nodes.push({ tag: element[1] as IconTag, attrs });
  }
  return nodes;
}
