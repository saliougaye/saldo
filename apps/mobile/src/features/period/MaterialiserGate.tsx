import { type ReactNode, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { db } from '../../db/client';
import { useDatabase } from '../../db/DatabaseProvider';
import { useSettings } from '../../db/hooks';
import { runMaterialiser } from '../../db/recurrenceService';
import { usePeriod } from './PeriodProvider';

/**
 * Runs the recurrence materialiser on app start and on every return to the foreground (§5.9).
 * It is idempotent, so re-running is free; the sync pull and recurrence writes trigger it too,
 * from their own call sites.
 */
export function MaterialiserGate({ children }: { children: ReactNode }) {
  const { repos } = useDatabase();
  const settings = useSettings();
  const { today, def } = usePeriod();
  const ready = settings !== null && settings.onboardingCompletedAt !== null;
  const lastRun = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const run = () => {
      runMaterialiser(db, repos, today, def);
      lastRun.current = today;
    };
    if (lastRun.current !== today) run();
    const onChange = (status: AppStateStatus) => {
      if (status === 'active') run();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [ready, repos, today, def]);

  return <>{children}</>;
}
