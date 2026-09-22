import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { reminderAccountId } from '../features/accounts/cardReminders';

/**
 * A tapped charge-day reminder opens the card's detail (§5.3), never a pre-saved transfer. Read
 * both from the listener (the app was running) and from the last response on mount (the tap
 * launched it).
 *
 * Called from the tabs layout, which only exists past the boot router and the lock, and the push
 * waits one tick and is dropped if the tabs have gone meanwhile: a tap that also re-locks the app
 * replaces the tabs with the lock (`startOver`), and the card must not open on top of it. The
 * response is cleared only once it has been followed, so the way back from the lock picks it up.
 */
export function useNotificationRoutes(): void {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const open = (response: Notifications.NotificationResponse | null): void => {
      if (response === null) return;
      const accountId = reminderAccountId(response.notification.request.content.data);
      if (accountId === null) return;
      setTimeout(() => {
        if (!mounted) return;
        Notifications.clearLastNotificationResponse();
        router.push({ pathname: '/account/[id]', params: { id: accountId } });
      }, 0);
    };
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [router]);
}
