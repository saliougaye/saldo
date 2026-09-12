/**
 * Server-side tagged logging, printed where the server runs: the terminal in development, the host's
 * log stream in production. Unlike the browser and app loggers this one stays on in production —
 * a self-hosted server whose sync is failing has no other witness.
 *
 * That is also why it carries so little: account ids as eight-character prefixes, codes, counts and
 * durations. Never a token, never an invite code, never a row's contents.
 */
const enabled: boolean = process.env.NODE_ENV !== 'test';

export function log(scope: string, message: string, detail?: Record<string, unknown>): void {
  if (!enabled) return;
  if (detail === undefined) console.log(`[saldo:${scope}] ${message}`);
  else console.log(`[saldo:${scope}] ${message}`, detail);
}

/** Enough of an id to follow one account across lines, not enough to be worth writing down. */
export function shortId(id: string | null | undefined): string {
  return id === null || id === undefined ? 'none' : id.slice(0, 8);
}

/** How long a request took, as a line fragment. */
export function ms(startedAt: number): string {
  return `${Date.now() - startedAt}ms`;
}
