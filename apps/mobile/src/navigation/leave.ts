import type { useRouter } from 'expo-router';

/**
 * Where to go once the thing this screen was editing no longer exists.
 *
 * `router.back()` is wrong after a delete: the screen underneath is the detail of the deleted row,
 * which renders as "nothing here". `dismissAll` returns to the first screen of the stack — the
 * tabs — and the `replace` is for the case where there is no stack to dismiss, such as a deep link
 * that opened the editor directly.
 */
export function leaveAfterDelete(
  router: ReturnType<typeof useRouter>,
  fallback: '/(tabs)/transactions' | '/(tabs)/accounts' | '/budgets' = '/(tabs)/transactions',
): void {
  if (router.canDismiss()) {
    router.dismissAll();
    return;
  }
  router.replace(fallback);
}
