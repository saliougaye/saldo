import { en } from './en';

/**
 * Spec 0.8a §04 (D43): one content object for each locale. The shape of `en` is the contract, so an
 * Italian object that misses a field does not type-check. Add a locale to `LOCALES`.
 */
export type SiteContent = typeof en;

export const LOCALES = { en } satisfies Record<string, SiteContent>;
