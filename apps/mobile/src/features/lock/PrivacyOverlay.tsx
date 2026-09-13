import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, View } from 'react-native';
import { useDatabase } from '../../db/DatabaseProvider';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * The two statuses during which the operating system photographs the screen for the app switcher:
 * iOS goes `inactive` first, Android goes straight to `background`. Anything else — `active`,
 * `unknown`, `extension`, or the `null` `currentState` carries until the native module answers —
 * leaves the app visible, and a cover over a visible app is worse than no cover at all.
 *
 * `inactive` also fires for the notification shade and an incoming call. Covering there too is
 * deliberate: those put the screen in front of whoever is holding the phone just as much.
 */
function isPhotographed(status: AppStateStatus | null): boolean {
  return status === 'inactive' || status === 'background';
}

/**
 * Paints the app out of the app switcher (§18).
 *
 * `useAppLock` re-locks on the way *back*, which is too late for this: by the time the user swipes
 * up, the system has already taken its snapshot of balances and transactions and put it in the
 * switcher, where it stays for anyone holding the phone. So the cover has to go up on the way out.
 *
 * Only when the app lock is on, reading the same `appLockEnabled` flag `useAppLock` reads: somebody
 * who did not turn the lock on did not ask for their screen to be hidden, and flashing a panel
 * every time the notification shade comes down is worse than not doing it. The flag is read inside
 * the handler rather than captured, so turning the lock on takes effect at the next status change
 * without a remount.
 *
 * An overlay rather than `expo-screen-capture`: `preventScreenCaptureAsync` sets `FLAG_SECURE` on
 * Android, which also blocks the user's own screenshots of an app they attach receipts to.
 */
export function PrivacyOverlay() {
  const { kv } = useDatabase();
  const theme = useTheme();
  // `addEventListener` only fires on *changes*, so the first frame comes from `currentState`:
  // launched or resumed into the background, the cover is already up.
  const [covered, setCovered] = useState(
    () => kv.get('appLockEnabled') === 'true' && isPhotographed(AppState.currentState),
  );

  useEffect(() => {
    const onChange = (status: AppStateStatus): void => {
      if (kv.get('appLockEnabled') !== 'true') {
        setCovered(false);
        return;
      }
      setCovered(isPhotographed(status));
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [kv]);

  if (!covered) return null;
  return (
    <View
      testID="privacy-overlay"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // The splash background: the switcher then shows what a cold start shows, not a grey slab.
        backgroundColor: theme.palette.page,
      }}
    />
  );
}
