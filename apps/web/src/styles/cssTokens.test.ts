import { describe, expect, it } from 'vitest';
import { findHardCodedValues, moduleCssFiles } from './cssTokens';

describe('findHardCodedValues', () => {
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
});

describe('the web app', () => {
  it('types no colour, font size or radius by hand in any CSS Module (§17.1.7)', () => {
    const offenders = moduleCssFiles().flatMap(({ path, css }) =>
      findHardCodedValues(css).map((value) => `${path}: ${value}`),
    );
    expect(offenders).toEqual([]);
  });
});
