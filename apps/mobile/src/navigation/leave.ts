import { useNavigation, useRouter } from 'expo-router';
import { useCallback } from 'react';

/** Something that has just been deleted or archived, and whose screens must not be gone back to. */
export interface Gone {
  kind: 'account' | 'budget' | 'category' | 'tag' | 'transaction';
  ids: readonly string[];
}

interface StackRoute {
  name: string;
  params?: object;
}

/** Whether a route of the root stack is the detail or the editor of something in `gone`. */
export function showsGone(route: StackRoute, gone: Gone): boolean {
  if (route.name !== `${gone.kind}/[id]` && route.name !== `${gone.kind}/edit/[id]`) return false;
  const id = route.params !== undefined && 'id' in route.params ? route.params.id : undefined;
  return typeof id === 'string' && gone.ids.includes(id);
}

/**
 * Leaves a screen whose subject has just been deleted or archived.
 *
 * `router.back()` is wrong here: the screen underneath is usually the detail of the same row, which
 * then shows an archived or empty version of it — and a swipe back from there can land on another
 * copy further down, pushed from a transaction or from Statistiche. `dismissAll` is wrong too: it
 * throws away the list you came from. So every screen of the row is taken out of the stack, wherever
 * it sits, and you arrive where you were before you first opened it.
 *
 * A reset that keeps the surviving routes' keys, so none of them remounts and native-stack animates
 * the top one away as a pop. When nothing survives — a deep link that opened the editor directly —
 * the tabs replace it.
 */
export function useLeaveGone(): (gone: Gone) => void {
  const navigation = useNavigation();
  const router = useRouter();
  return useCallback(
    (gone: Gone) => {
      const state = navigation.getState();
      const routes = state?.routes.filter((route) => !showsGone(route, gone)) ?? [];
      if (state === undefined || routes.length === 0) {
        router.replace('/(tabs)');
        return;
      }
      navigation.dispatch({
        type: 'RESET',
        payload: { ...state, routes, index: routes.length - 1 },
      });
    },
    [navigation, router],
  );
}
