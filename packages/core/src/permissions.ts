/**
 * The onboarding permissions step and Profile → Permessi (§6.29). The OS calls live in the app;
 * these are the rules that read their answers.
 */

/** The rows, in the order the step asks them. `appLock` is a setting, not an OS permission. */
export type PermissionKey = 'notifications' | 'camera' | 'appLock';
export const PERMISSION_ORDER: readonly PermissionKey[] = ['notifications', 'camera', 'appLock'];

/** What the step knows about a row. `later` is «Più tardi»: skipped, asked in context instead. */
export type PermissionAnswer = 'pending' | 'granted' | 'denied' | 'later';

/** The two fields every Expo permission response carries. */
export interface OsPermission {
  granted: boolean;
  canAskAgain: boolean;
}

/** What the OS will do if asked: nothing (granted), prompt (askable), or refuse (denied). */
export type PermissionState = 'granted' | 'askable' | 'denied';

export function permissionState(permission: OsPermission): PermissionState {
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'askable' : 'denied';
}

/**
 * The answer after the system prompt. A refusal is final for this step even where Android would
 * prompt once more: asking twice in a row is exactly the nagging the step exists to avoid.
 */
export function answerFromRequest(permission: OsPermission): PermissionAnswer {
  return permission.granted ? 'granted' : 'denied';
}

/** The `error` values of `expo-local-authentication` that mean "nobody decided anything". */
const CANCELLED = new Set(['user_cancel', 'system_cancel', 'app_cancel']);

/** The lock row after `authenticateAsync`: on, still open (cancelled), or not available. */
export function answerFromUnlock(result: { success: boolean; error?: string }): PermissionAnswer {
  if (result.success) return 'granted';
  return result.error !== undefined && CANCELLED.has(result.error) ? 'pending' : 'denied';
}

/**
 * A fresh OS read against the answer on screen. The OS fills a row nobody answered yet (a
 * reinstall keeps its permissions) and may upgrade anything to granted (the user switched it on
 * in the settings), but it never reopens an answer the user gave.
 */
export function mergeOsState(current: PermissionAnswer, state: PermissionState): PermissionAnswer {
  if (state === 'granted') return 'granted';
  if (current !== 'pending') return current;
  return state === 'denied' ? 'denied' : 'pending';
}

/** The row that is open: the first one still pending, or none. */
export function nextPending(
  answers: Readonly<Record<PermissionKey, PermissionAnswer>>,
): PermissionKey | null {
  return PERMISSION_ORDER.find((key) => answers[key] === 'pending') ?? null;
}
