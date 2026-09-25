/**
 * Device-local, never synced (§5.16): the `onboardingCompletedAt` the intro was last dismissed for.
 * Keyed on that timestamp rather than a plain flag, so finishing onboarding again — «Rivedi la
 * configurazione iniziale», «Elimina tutti i dati», a reset — shows the intro again without anybody
 * remembering to clear a key.
 */
export const INTRO_KEY = 'introSeenFor';

export function isIntroDue(input: {
  onboardingCompletedAt: string | null;
  stored: string | null;
}): boolean {
  return input.onboardingCompletedAt !== null && input.onboardingCompletedAt !== input.stored;
}
