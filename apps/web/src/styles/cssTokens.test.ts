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
