import { describe, expect, it } from 'vitest';
import {
  categoryColorNames,
  categoryColors,
  emptyState,
  layout,
  mascot,
  motion,
  palettes,
  trackingPx,
  withAlpha,
} from './tokens';

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
  it('has twenty-four swatches, the original ten first', () => {
    expect(categoryColors).toHaveLength(24);
    // Stored indices must keep their meaning: a row saved with 4 was teal and stays teal.
    expect(categoryColors.slice(0, 10)).toEqual([
      '#C57B4E',
      '#B4894A',
      '#8F9152',
      '#63926F',
      '#4F8D8B',
      '#5A82A6',
      '#7A79AC',
      '#A06FA0',
      '#AF6B7B',
      '#8A8A8A',
    ]);
  });

  it('are valid, distinct hex colours', () => {
    for (const colour of categoryColors) expect(colour).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(categoryColors).size).toBe(categoryColors.length);
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

describe('ghost colours', () => {
  it('stand further off the page than a plain surface does, in both themes', () => {
    // Review found the dark stack invisible when it was drawn with surface/border on #0A0A0A.
    for (const theme of ['dark', 'light'] as const) {
      const p = palettes[theme];
      expect(contrast(p.ghost, p.bg)).toBeGreaterThanOrEqual(contrast(p.surface, p.bg));
    }
    expect(palettes.dark.ghost).not.toBe(palettes.dark.surface);
  });

  it('keep the ink inside a ghost visible against the ghost itself', () => {
    for (const theme of ['dark', 'light'] as const) {
      const p = palettes[theme];
      expect(contrast(p.ghostInk, p.ghost)).toBeGreaterThan(1.5);
    }
  });
});

describe('emptyState', () => {
  it('stacks three layers, each further back, smaller and fainter than the one before', () => {
    const { layers, opacity } = emptyState;
    expect(layers).toHaveLength(3);
    for (let i = 1; i < layers.length; i++) {
      const front = layers[i - 1];
      const back = layers[i];
      if (front === undefined || back === undefined) throw new Error('layer missing');
      expect(back.translateY).toBeLessThan(front.translateY);
      expect(back.scale).toBeLessThan(front.scale);
      for (const theme of ['dark', 'light'] as const) {
        expect(opacity[theme][i] ?? 1).toBeLessThan(opacity[theme][i - 1] ?? 0);
      }
    }
  });

  it('keeps the back layers more opaque on dark, where the page swallows them', () => {
    expect(emptyState.opacity.dark[2]).toBeGreaterThan(emptyState.opacity.light[2]);
  });
});

describe('mascot', () => {
  it('shows only part of Rocky when he peeks', () => {
    expect(mascot.emptyWindow).toBeLessThan(mascot.emptySize);
    expect(mascot.cardWindow).toBeLessThan(mascot.cardSize);
  });

  it('cuts him below his chin, not across his face', () => {
    // His muzzle ends at about 60% of the PNG; the cut must fall under it.
    expect(mascot.emptyWindow / mascot.emptySize + mascot.trimTop).toBeGreaterThan(0.68);
    expect(mascot.cardWindow / mascot.cardSize + mascot.trimTop).toBeGreaterThan(0.68);
  });

  it('trims only the empty margin above his ears', () => {
    expect(mascot.trimTop).toBeGreaterThan(0);
    expect(mascot.trimTop).toBeLessThan(0.18);
  });

  it('starts below the edge, but never so far that he rises from nothing', () => {
    expect(mascot.peekFromRatio).toBeGreaterThan(0);
    expect(mascot.peekFromRatio).toBeLessThan(1);
  });

  it('lands after the ghost stack, so he is the last thing to settle', () => {
    const stackLands = emptyState.enterMs + 2 * emptyState.staggerMs;
    expect(mascot.emptyDelayMs + mascot.peekMs).toBeGreaterThan(stackLands);
  });

  it('celebrates from a visible scale, never from zero', () => {
    expect(mascot.celebrateFromScale).toBeGreaterThanOrEqual(0.9);
    expect(mascot.celebrateFromScale).toBeLessThan(1);
  });

  it('overshoots: the one curve in the app that goes past its target', () => {
    const [, y1] = mascot.overshootEasing;
    expect(y1).toBeGreaterThan(1);
  });
});

describe('onboarding step motion', () => {
  it('leaves faster than it arrives, and words follow closer than chunks', () => {
    expect(motion.stepExitMs).toBeLessThan(motion.stepEnterMs);
    expect(motion.stepWordStaggerMs).toBeLessThan(motion.stepChunkStaggerMs);
    // Under 300ms of stagger for a four-chunk step keeps the card tappable before the eye is done
    // reading the title (stagger is decorative, never blocking).
    expect(motion.stepChunkStaggerMs * 3).toBeLessThanOrEqual(300);
  });

  it('draws the step segments as a 2px strip (§6.29)', () => {
    expect(layout.stepSegmentHeight).toBe(2);
    expect(layout.stepSegmentGap).toBeGreaterThan(0);
  });
});

describe('permissions list motion', () => {
  it('reveals the body inside the row growth and swaps within the UI budget', () => {
    expect(motion.revealDelayMs).toBeLessThan(motion.expandMs);
    expect(motion.expandMs).toBeLessThanOrEqual(300);
    // better-ui: a swap never starts from nothing, and the icon travels further than the text.
    expect(motion.swapFromScale).toBeGreaterThanOrEqual(0.95);
    expect(motion.swapIconFromScale).toBeLessThan(motion.swapFromScale);
    expect(motion.swapEasing).toHaveLength(4);
  });
});

describe('target card layout', () => {
  it('draws the featured bar twice as thick as a row bar, with a longer pace tick', () => {
    expect(layout.progressHeightThick).toBe(layout.progressHeight * 2);
    expect(layout.paceTickOverhangThick).toBeGreaterThan(layout.paceTickOverhang);
  });

  it('sizes the event-row ring like an icon box and the preview ring smaller', () => {
    expect(layout.targetRing).toBeGreaterThanOrEqual(layout.iconBox);
    expect(layout.targetRingSmall).toBeLessThan(layout.targetRing);
  });
});
