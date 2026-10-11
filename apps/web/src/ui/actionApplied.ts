/**
 * Resolves when Next has applied the response of the Server Action that the caller awaited. Await
 * it before a navigation that follows a save.
 *
 * The action's promise resolves before the router applies the action's response. A navigation in
 * that gap discards the response. If the action refreshed the page (`refreshAfterWrite`,
 * `revalidatePath`), Next then runs `router.refresh()` by itself: it renders the whole page again
 * and prefetches every visible link again. Next applies the response in microtasks, so one task is
 * enough.
 */
export function actionApplied(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
