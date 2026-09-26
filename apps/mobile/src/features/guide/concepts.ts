import type { IconName } from '@saldo/ui';

/** The Guida's groups, in the order its screen lists them (§6.42). */
export const GUIDE_SECTIONS = ['basics', 'accounts', 'plan', 'organize', 'data'] as const;
export type GuideSection = (typeof GUIDE_SECTIONS)[number];

export interface GuideConcept {
  /** Also the i18n key: `guide.<id>.{title,summary,body}`. */
  id: string;
  icon: IconName;
  section: GuideSection;
  /** One of the ideas that change how the app is used from the first day (§6.40). */
  intro: boolean;
}

/**
 * §5.16. The one list the intro, the ⓘ and the Guida all read, so the three cannot drift apart:
 * a concept added here is in the Guida, and in the intro if it says so, with nothing else to wire.
 * The text lives in the catalogues, not here.
 */
export const GUIDE_CONCEPTS = [
  { id: 'period', icon: 'cal', section: 'basics', intro: true },
  { id: 'remaining', icon: 'wallet', section: 'basics', intro: true },
  { id: 'transfers', icon: 'swap', section: 'basics', intro: true },
  { id: 'accountTypes', icon: 'landmark', section: 'accounts', intro: false },
  { id: 'creditCard', icon: 'card', section: 'accounts', intro: false },
  { id: 'budgets', icon: 'target', section: 'plan', intro: false },
  { id: 'goals', icon: 'piggy', section: 'plan', intro: false },
  { id: 'recurring', icon: 'repeat', section: 'plan', intro: true },
  { id: 'tags', icon: 'tag', section: 'organize', intro: false },
  { id: 'hidden', icon: 'eyeOff', section: 'organize', intro: false },
  { id: 'data', icon: 'server', section: 'data', intro: false },
] as const satisfies readonly GuideConcept[];

export type GuideConceptId = (typeof GUIDE_CONCEPTS)[number]['id'];

export const INTRO_CONCEPTS = GUIDE_CONCEPTS.filter((concept) => concept.intro);

export function isGuideConceptId(value: string): value is GuideConceptId {
  return GUIDE_CONCEPTS.some((concept) => concept.id === value);
}

export function guideConcept(id: string): (typeof GUIDE_CONCEPTS)[number] | undefined {
  return GUIDE_CONCEPTS.find((concept) => concept.id === id);
}

/** A body's paragraphs: the catalogues separate them with a blank line. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
