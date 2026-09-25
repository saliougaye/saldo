import { catalogs, SUPPORTED_LOCALES } from '@saldo/i18n';
import {
  GUIDE_CONCEPTS,
  GUIDE_SECTIONS,
  guideConcept,
  INTRO_CONCEPTS,
  isGuideConceptId,
  paragraphs,
} from './concepts';

describe('GUIDE_CONCEPTS', () => {
  it('puts the four ideas that change day one in the intro, in order', () => {
    expect(INTRO_CONCEPTS.map((concept) => concept.id)).toEqual([
      'period',
      'remaining',
      'transfers',
      'recurring',
    ]);
  });

  it('uses every section, and only those', () => {
    const used = new Set(GUIDE_CONCEPTS.map((concept) => concept.section));
    expect([...used].sort()).toEqual([...GUIDE_SECTIONS].sort());
  });

  it.each(SUPPORTED_LOCALES)(
    'has a title, a summary and a body for every concept in %s',
    (locale) => {
      const guide = catalogs[locale].guide as unknown as Record<string, unknown>;
      for (const concept of GUIDE_CONCEPTS) {
        const entry = guide[concept.id] as { title: string; summary: string; body: string };
        expect([concept.id, entry.title.trim() !== '']).toEqual([concept.id, true]);
        expect([concept.id, entry.summary.trim() !== '']).toEqual([concept.id, true]);
        expect([concept.id, paragraphs(entry.body).length > 0]).toEqual([concept.id, true]);
      }
    },
  );

  it('finds a concept by id and refuses anything else', () => {
    expect(guideConcept('budgets')?.icon).toBe('target');
    expect(isGuideConceptId('budgets')).toBe(true);
    expect(isGuideConceptId('nope')).toBe(false);
    expect(guideConcept('nope')).toBeUndefined();
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and drops empty ones', () => {
    expect(paragraphs('One.\n\nTwo.\n\n\n\n  Three.  ')).toEqual(['One.', 'Two.', 'Three.']);
  });
});
