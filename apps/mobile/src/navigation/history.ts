import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * Arrives at the tabs, which are the bottom of the app: nothing may sit under them.
 *
 * Not `replace`. At the root stack that swaps only the top route, so unlocking over a pushed screen
 * — `[tabs, lock]` — ended as `[tabs, tabs]`, and the edge swipe went back to a stale copy of the
 * tabs. `dismissTo` pops back to the tabs already in the history, and replaces only when there
 * are none: after onboarding, or a cold start behind the lock.
 */
export function enterTabs(router: Router): void {
  router.dismissTo('/(tabs)');
}

/**
 * Opens a screen that must have nothing behind it: the lock screen, which a swipe or Android's back
 * must not uncover, and the boot router after signing out or restoring, which would otherwise sit
 * over screens of a session that is gone.
 */
export function startOver(router: Router, href: '/' | '/lock'): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
