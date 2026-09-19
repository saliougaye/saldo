import { describe, expect, it } from 'vitest';
import { parseIconMarkup } from './iconNodes';
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
