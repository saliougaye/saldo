import type { LocalDate, Settings } from '@saldo/core';
import { isTimeZone, localDateOf, wallClock } from '@saldo/i18n';

/**
 * The zone the server computes a user's day in (§17.1.5): theirs, or the instance's fallback when
 * they have none yet or it names a zone `Intl` does not know (renamed, or edited by hand).
 */
export function resolveTimeZone(saved: string | null | undefined, fallback: string): string {
  return saved !== null && saved !== undefined && isTimeZone(saved) ? saved : fallback;
}

/**
 * «Today» for a user, as a `LocalDate` to inject into core like the phone injects its own
 * (§17.1.5). `fallback` is `env().defaultTimeZone`, which `readEnv` has already validated.
 */
export function todayFor(
  settings: Pick<Settings, 'timeZone'> | null,
  fallback: string,
  now: Date = new Date(),
): { today: LocalDate; timeZone: string } {
  const timeZone = resolveTimeZone(settings?.timeZone, fallback);
  const clock = wallClock(timeZone, now) ?? wallClock('UTC', now);
  if (clock === null) throw new Error('Intl cannot read UTC');
  return { today: localDateOf(clock), timeZone };
}
