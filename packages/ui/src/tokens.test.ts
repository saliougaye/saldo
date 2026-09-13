import { describe, expect, it } from 'vitest';
import { categoryColorNames, categoryColors, palettes, trackingPx, withAlpha } from './tokens';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

/** WCAG contrast ratio between two `#RRGGBB` colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const COLOR = /^(#[0-9A-F]{6}|rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d+)\))$/;

function flatten(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  return Object.values(value as Record<string, unknown>).flatMap(flatten);
}

describe('palettes', () => {
  it('define the same tokens for dark and light', () => {
    expect(Object.keys(palettes.light).sort()).toEqual(Object.keys(palettes.dark).sort());
  });

  it('only contain valid colours', () => {
    for (const colour of [...flatten(palettes.dark), ...flatten(palettes.light)]) {
      expect(colour).toMatch(COLOR);
    }
  });

  it('uses a neutral accent that inverts between themes', () => {
    expect(palettes.dark.accent).toBe('#C7C7C7');
    expect(palettes.light.accent).toBe('#4A4A46');
  });

  it('keeps the accent readable against its own background and its onAccent', () => {
    // A neutral accent only works if it is the high-contrast grey of its theme: bright on dark,
    // dark on light. Guard both, since a mid grey would fail on one of them.
    expect(contrast(palettes.dark.accent, palettes.dark.bg)).toBeGreaterThan(4.5);
    expect(contrast(palettes.dark.accent, palettes.dark.onAccent)).toBeGreaterThan(4.5);
    expect(contrast(palettes.light.accent, palettes.light.bg)).toBeGreaterThan(4.5);
    expect(contrast(palettes.light.accent, palettes.light.onAccent)).toBeGreaterThan(4.5);
  });

  it('keeps accent distinguishable from the neutral bar colour', () => {
    // The design signalled "over pace" with hue; a neutral accent signals it with brightness,
    // so accent and barGrey must stay far apart in both themes.
    expect(contrast(palettes.dark.accent, palettes.dark.barGrey)).toBeGreaterThan(3);
    expect(contrast(palettes.light.accent, palettes.light.barGrey)).toBeGreaterThan(3);
  });

  it('keeps the "other categories" segment outside the segment ramp', () => {
    for (const theme of ['dark', 'light'] as const) {
      const { segments, segmentOther } = palettes[theme];
      for (const segment of segments) expect(segment).not.toBe(segmentOther);
    }
  });
});

describe('categoryColors', () => {
  it('has ten swatches', () => {
    expect(categoryColors).toHaveLength(10);
  });

  it('names every one of them', () => {
    // An unnamed swatch is announced as a hex code, which is the state this list exists to end.
    expect(categoryColorNames).toHaveLength(categoryColors.length);
    expect(new Set(categoryColorNames).size).toBe(categoryColorNames.length);
  });
});

describe('trackingPx', () => {
  it('converts em to px for a font size', () => {
    expect(trackingPx(-0.02, 24)).toBe(-0.48);
    expect(trackingPx(-0.01, 15)).toBe(-0.15);
  });
});

describe('withAlpha', () => {
  it('appends a two digit alpha channel', () => {
    expect(withAlpha('#C57B4E', 0x22 / 255)).toBe('#C57B4E22');
    expect(withAlpha('#c57b4e', 1)).toBe('#C57B4EFF');
    expect(withAlpha('#C57B4E', 0)).toBe('#C57B4E00');
  });

  it('rejects non hex colours', () => {
    expect(() => withAlpha('red', 0.5)).toThrow(RangeError);
  });
});
