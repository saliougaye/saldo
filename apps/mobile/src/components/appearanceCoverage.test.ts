import { MAX_COLOR_INDEX } from '@saldo/core';
import { en, it as itMessages } from '@saldo/i18n';
import { categoryColorNames, categoryColors, categoryIconGroups } from '@saldo/ui';

/** The one place that sees core, ui and i18n together, so the cross-package guarantees live here. */
describe('appearance data', () => {
  it('has exactly as many swatches as the schema allows', () => {
    expect(categoryColors).toHaveLength(MAX_COLOR_INDEX + 1);
  });

  it('translates every swatch name in both languages', () => {
    for (const name of categoryColorNames) {
      expect(typeof en.colors[name]).toBe('string');
      expect(typeof itMessages.colors[name]).toBe('string');
    }
  });

  it('translates every icon group in both languages', () => {
    for (const { key } of categoryIconGroups) {
      expect(typeof en.iconGroups[key]).toBe('string');
      expect(typeof itMessages.iconGroups[key]).toBe('string');
    }
  });
});
