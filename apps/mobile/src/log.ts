/**
 * Tagged console logging for the flows that are hard to watch from outside: signing in, wiping the
 * device, the first sync, and the boot router's decision. Those happen across three providers and
 * a redirect, so a screen that sits on a spinner tells you nothing about which of them is waiting.
 *
 * Development only. A release build has no console worth writing to, and these lines name account
 * ids — short prefixes, never a token, never an invite code, but still not something to leave
 * printing on somebody's phone.
 */
export function log(scope: string, message: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail === undefined) console.log(`[saldo:${scope}] ${message}`);
  else console.log(`[saldo:${scope}] ${message}`, detail);
}

/** Enough of an id to follow it across lines, not enough to be worth writing down. */
export function shortId(id: string | null | undefined): string {
  return id === null || id === undefined ? 'none' : id.slice(0, 8);
}
