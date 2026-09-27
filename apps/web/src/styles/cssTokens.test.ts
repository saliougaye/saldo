import { describe, expect, it } from 'vitest';
import { findHardCodedValues, moduleCssFiles } from './cssTokens';

describe('findHardCodedValues', () => {
  it('accepts values that come from the token variables', () => {
    const css = `.card { background: var(--color-surface); border-radius: var(--radius-card);
      font-size: var(--font-size-body); padding: var(--layout-card-padding); border-radius: 0; }`;
    expect(findHardCodedValues(css)).toEqual([]);
  });

  it('refuses hex, rgb and hsl colours', () => {
    expect(findHardCodedValues('.a { color: #EDEDED; }')).toEqual(['#EDEDED']);
    expect(findHardCodedValues('.a { color: #fff; }')).toEqual(['#fff']);
    expect(findHardCodedValues('.a { color: rgba(0, 0, 0, 0.5); }')).toEqual(['rgba(']);
    expect(findHardCodedValues('.a { color: hsl(0 0% 50%); }')).toEqual(['hsl(']);
  });

  it('refuses literal font sizes and radii', () => {
    expect(findHardCodedValues('.a { font-size: 15px; }')).toEqual(['font-size: 15px']);
    expect(findHardCodedValues('.a { font-size: 0.9rem; }')).toEqual(['font-size: 0.9rem']);
    expect(findHardCodedValues('.a { border-radius: 12px; }')).toEqual(['border-radius: 12px']);
    expect(findHardCodedValues('.a { border-top-left-radius: 3px; }')).toEqual([
      'border-top-left-radius: 3px',
    ]);
  });

  it('reads the whole value of a font or radius declaration, in any case', () => {
    expect(findHardCodedValues('.a { font: 15px/1.2 serif; }')).toEqual(['font: 15px/1.2 serif']);
    expect(findHardCodedValues('.a { border-radius: 0 0 4px 4px; }')).toEqual([
      'border-radius: 0 0 4px 4px',
    ]);
    expect(findHardCodedValues('.a { border-radius: var(--radius-card) 4px; }')).toEqual([
      'border-radius: var(--radius-card) 4px',
    ]);
    expect(findHardCodedValues('.a { font-size: var(--x, 14px); }')).toEqual([
      'font-size: var(--x, 14px)',
    ]);
    expect(findHardCodedValues('.a { font-size: 12pt; }')).toEqual(['font-size: 12pt']);
    expect(findHardCodedValues('.a { font-size: calc(var(--y) * 2); }')).toEqual([
      'font-size: calc(var(--y) * 2)',
    ]);
    expect(findHardCodedValues('.a { FONT-SIZE: 15PX; }')).toEqual(['font-size: 15PX']);
  });

  it('refuses the newer colour functions and any case', () => {
    expect(findHardCodedValues('.a { color: oklch(0.7 0.1 200); }')).toEqual(['oklch(']);
    expect(findHardCodedValues('.a { color: lab(50 0 0); }')).toEqual(['lab(']);
    expect(findHardCodedValues('.a { color: RGB(0, 0, 0); }')).toEqual(['RGB(']);
  });

  it('does not take an id or an SVG reference for a colour', () => {
    expect(findHardCodedValues('#add .a { mask: url(#bead); }')).toEqual([]);
  });

  it('ignores what sits in comments', () => {
    expect(findHardCodedValues('/* was #EDEDED */ .a { color: var(--color-text); }')).toEqual([]);
  });
});

describe('the web app', () => {
  it('types no colour, font size or radius by hand in any CSS Module (§17.1.7)', () => {
    const offenders = moduleCssFiles().flatMap(({ path, css }) =>
      findHardCodedValues(css).map((value) => `${path}: ${value}`),
    );
    expect(offenders).toEqual([]);
  });
});
