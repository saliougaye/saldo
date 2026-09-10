import { describe, expect, it } from 'vitest';
import { categoryColors, palettes, trackingPx, withAlpha } from './tokens';

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

  it('keeps the design accent colours', () => {
    expect(palettes.dark.accent).toBe('#E8823C');
    expect(palettes.light.accent).toBe('#C4661D');
  });
});

describe('categoryColors', () => {
  it('has ten swatches', () => {
    expect(categoryColors).toHaveLength(10);
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
