import { describe, expect, it } from 'vitest';
import { iconNodeKey, parseIconMarkup } from './iconNodes';
import { accountIconOptions, categoryIconGroups, ICON_NAMES, iconMarkup, iconNodes } from './icons';

describe('parseIconMarkup', () => {
  it('parses paths, circles and rects with camelCase attributes', () => {
    expect(parseIconMarkup(iconMarkup.battery)).toEqual([
      { tag: 'rect', attrs: { x: '2', y: '7', width: '17', height: '10', rx: '2.5' } },
      { tag: 'path', attrs: { d: 'M21.5 11v2' } },
      {
        tag: 'rect',
        attrs: {
          x: '4.5',
          y: '9.5',
          width: '11',
          height: '5',
          rx: '1',
          fill: 'currentColor',
          stroke: 'none',
        },
      },
    ]);
    expect(parseIconMarkup(iconMarkup.cellular)[0]?.attrs.strokeWidth).toBe('2.4');
  });

  it('ignores unsupported elements', () => {
    expect(parseIconMarkup('<g/><line x1="0"/>')).toEqual([]);
  });
});

describe('icon set', () => {
  it('contains the 74 design icons plus the Lucide additions, each with at least one node', () => {
    expect(ICON_NAMES).toHaveLength(134);
    // Added beyond the design's set; see the comment on `iconMarkup`.
    expect(ICON_NAMES).toContain('chevUD');
    for (const name of ICON_NAMES) {
      expect(iconNodes[name].length, name).toBeGreaterThan(0);
    }
    expect(iconNodes.grip.filter((node) => node.tag === 'circle')).toHaveLength(6);
  });

  it('gives every node of an icon a distinct key', () => {
    // `target` is three circles sharing one centre: only the radius tells them apart.
    for (const name of ICON_NAMES) {
      const keys = iconNodes[name].map(iconNodeKey);
      expect(new Set(keys).size, name).toBe(keys.length);
    }
  });

  it('offers every category icon exactly once in the picker', () => {
    const offered: string[] = categoryIconGroups.flatMap((group) => [...group.icons]);
    expect(new Set(offered).size).toBe(offered.length);
    for (const name of ['sofa', 'dog', 'shirt', 'laptop', 'banknote']) {
      expect(offered).toContain(name);
    }
  });

  it('only references existing icons in picker groups', () => {
    const icons = [...categoryIconGroups.flatMap((group) => group.icons), ...accountIconOptions];
    for (const name of icons) expect(ICON_NAMES).toContain(name);
  });
});

/**
 * Arc commands are left out: their flags are legally written glued to the next number
 * (`a2 2 0 00-2-2`), which no small tokenizer can split without the full grammar.
 */
const ARGUMENTS_PER_COMMAND: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  z: 0,
};
const PATH_TOKEN = /[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/** The command letters with the number of arguments each of their runs is short or long by. */
function malformedCommands(d: string): string[] {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const problems: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) break;
    index += 1;
    if (!/[A-Za-z]/.test(token)) {
      problems.push(`${token} is not a command`);
      continue;
    }
    let count = 0;
    while (index < tokens.length && !/[A-Za-z]/.test(tokens[index] ?? '')) {
      count += 1;
      index += 1;
    }
    const arity = ARGUMENTS_PER_COMMAND[token.toLowerCase()];
    if (arity === undefined || arity === 0) continue;
    if (count === 0 || count % arity !== 0) problems.push(`${token} takes ${count}`);
  }
  return problems;
}

describe('icon geometry', () => {
  // react-native-svg's parser walks a malformed `d` off the end of the string and the app dies
  // with `NSInvalidArgumentException: -[__NSCFString characterAtIndex:]`, in a `Pressable` far
  // from the icon. A bad Lucide `polyline` → `path` rewrite is all it takes.
  it('gives every path command the arguments it takes', () => {
    for (const name of ICON_NAMES) {
      for (const node of iconNodes[name]) {
        if (node.tag !== 'path') continue;
        expect(malformedCommands(node.attrs.d ?? ''), name).toEqual([]);
      }
    }
  });
});
