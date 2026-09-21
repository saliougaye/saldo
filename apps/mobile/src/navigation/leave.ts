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
 * Rewrites the root stack in one dispatch, keeping the surviving routes' keys so none of them
 * remounts and native-stack animates the top one away as a pop. When nothing survives — a deep
 * link that opened the editor directly — the tabs replace it.
 */
function useResetStack() {
  const navigation = useNavigation();
  const router = useRouter();
  /** The navigator's own route type, which only a value can name. */
  type Route = NonNullable<ReturnType<typeof navigation.getState>>['routes'][number];
  return useCallback(
    (rewrite: (routes: Route[]) => Route[]) => {
      const state = navigation.getState();
      const routes = state === undefined ? [] : rewrite([...state.routes]);
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

/**
 * Leaves a screen whose subject has just been deleted or archived.
 *
 * `router.back()` is wrong here: the screen underneath is usually the detail of the same row, which
 * then shows an archived or empty version of it — and a swipe back from there can land on another
 * copy further down, pushed from a transaction or from Statistiche. `dismissAll` is wrong too: it
 * throws away the list you came from. So every screen of the row is taken out of the stack, wherever
 * it sits, and you arrive where you were before you first opened it.
 */
export function useLeaveGone(): (gone: Gone) => void {
  const reset = useResetStack();
  return useCallback(
    (gone) => reset((routes) => routes.filter((route) => !showsGone(route, gone))),
    [reset],
  );
}

/** A row that has just been saved under a new id, and whose screens must follow it there. */
export interface Renamed {
  kind: Gone['kind'];
  from: string;
  to: string;
}

/**
 * Leaves an editor whose subject was saved under a different id — today only "Ripeti" on an
 * existing transaction, which replaces the row with the deterministic first occurrence of the new
 * series (D21, §5.9).
 *
 * `router.back()` is wrong for the same reason as in `useLeaveGone`: the detail underneath still
 * carries the old id, which no longer resolves, so it renders as "not found". Every detail of the
 * old id takes the new one instead, and the editor itself — the screen being left — goes.
 */
export function useLeaveRenamed(): (renamed: Renamed) => void {
  const reset = useResetStack();
  return useCallback(
    (renamed) =>
      reset((routes) =>
        routes.flatMap((route) => {
          if (!showsGone(route, { kind: renamed.kind, ids: [renamed.from] })) return [route];
          if (route.name === `${renamed.kind}/edit/[id]`) return [];
          return [{ ...route, params: { ...route.params, id: renamed.to } }];
        }),
      ),
    [reset],
  );
}
