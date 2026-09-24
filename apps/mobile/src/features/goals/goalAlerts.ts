import type { KvStore } from '../../db/kv';
import type { GoalView } from './goalViews';

/** kv key set once a goal's «raggiunto» notification has been sent (§5.14). */
export function goalAlertKey(goalId: string): string {
  return `goalReached:${goalId}`;
}

/** Reached goals not yet notified on this device. Pure: reads the store, never writes it. */
export function pendingGoalAlerts(
  views: readonly GoalView[],
  store: Pick<KvStore, 'get'>,
): GoalView[] {
  return views.filter(
    (view) =>
      view.progress.state === 'reached' && store.get(goalAlertKey(view.account.id)) === null,
  );
}
