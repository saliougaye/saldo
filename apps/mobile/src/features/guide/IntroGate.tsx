import { useState } from 'react';
import { useDatabase } from '../../db/DatabaseProvider';
import { useSettings } from '../../db/hooks';
import { IntroSheet } from './IntroSheet';
import { INTRO_KEY, isIntroDue } from './introSchedule';

/**
 * §5.16: the first-run intro, once per finished onboarding. Mounted in the tabs layout next to the
 * period recap and held back while `blocked` — one sheet at a time, the recap first.
 */
export function IntroGate({ blocked }: { blocked: boolean }) {
  const { kv } = useDatabase();
  const settings = useSettings();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  if (settings === null || blocked) return null;
  const completedAt = settings.onboardingCompletedAt;
  if (completedAt === dismissedFor) return null;
  if (!isIntroDue({ onboardingCompletedAt: completedAt, stored: kv.get(INTRO_KEY) })) return null;
  return (
    <IntroSheet
      onClose={() => {
        if (completedAt !== null) kv.set(INTRO_KEY, completedAt);
        setDismissedFor(completedAt);
      }}
    />
  );
}
