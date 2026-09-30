/** Where the budgets live since 0.3e-2b; `/budgets` only forwards here. */
export const BUDGETS_PATH = '/profile/budgets';

/** `/budgets`'s query string (`?new`, `?b=…`) carried over to `/profile/budgets`. */
export function legacyBudgetsTarget(params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const search = query.toString();
  return search === '' ? BUDGETS_PATH : `${BUDGETS_PATH}?${search}`;
}
